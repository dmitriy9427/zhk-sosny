# 2. Фильтры и каталог

[src/lib/filters.ts](../../src/lib/filters.ts), [src/modules/catalog/index.ts](../../src/modules/catalog/index.ts),
разметка — `src/pages/flats/index.astro`.

## Где на экране

«Квартиры»: слева фильтры (комнаты, ползунки цены, площади и этажа, башня, только свободные,
отделка, сортировка), справа «Найдено: 52 квартиры», шахматка с подсвеченными ячейками и список
карточек с «Показать ещё».

## Что делает

- Читает фильтры из адреса при загрузке и выставляет их в форму.
- На любое изменение формы: считает результат, подсвечивает шахматку, перерисовывает список, пишет
  адрес.
- Показывает по 24 карточки.
- Не засоряет историю браузера.

## Три представления одного и того же

```mermaid
flowchart LR
    F[Форма<br/>чекбоксы, ползунки] -- read() --> O[Filters<br/>объект]
    O -- write() --> F
    U[Адрес<br/>?rooms=2&tower=1] -- fromSearch() --> O
    O -- toSearch() --> U
    O -- applyFilters() --> R[Результат<br/>Flat[]]
```

Центр — объект `Filters`. Форма и адрес — две «внешние» формы записи, и для каждой есть пара
функций туда-обратно.

## `lib/filters.ts` — чистые функции

```ts
export function matches(flat: Flat, f: Filters) {
  return (
    (f.rooms.length === 0 || f.rooms.includes(flat.rooms)) &&
    inRange(flat.price, f.price) &&
    inRange(flat.area, f.area) &&
    inRange(flat.floor, f.floor) &&
    (f.tower === null || flat.tower === f.tower) &&
    (!f.onlyFree || flat.status === 'free') &&
    (f.finish.length === 0 || f.finish.includes(flat.finish))
  )
}
```

Каждое условие читается как «фильтр не задан **или** квартира подходит». Пустой список комнат —
«любые».

```ts
const SORTERS: Record<Filters['sort'], (a: Flat, b: Flat) => number> = {
  price: (a, b) => a.price - b.price,
  '-price': (a, b) => b.price - a.price,
  floor: (a, b) => a.floor - b.floor || a.position - b.position,
  …
}
```

Таблица сортировок вместо `switch`. `||` во `floor` — при равном этаже порядок по позиции (без
этого порядок квартир одного этажа скакал бы).

```ts
export function fromSearch(search: string): Filters {
  const p = new URLSearchParams(search)
  return {
    rooms: list('rooms').map(Number).filter((n) => [0, 1, 2, 3].includes(n)),
    price: parseRange(p.get('price')),
    tower: [1, 2, 3].includes(Number(p.get('tower'))) ? Number(p.get('tower')) : null,
    onlyFree: p.get('status') !== 'all',
    sort: sort in SORTERS ? sort : 'price',
    …
  }
}
```

Каждое значение из адреса проверяется: неизвестные комнаты выбрасываются, несуществующая башня —
«любая», неизвестная сортировка — по цене. `parseRange` переставляет границы местами, если
`?price=12000000-5000000`.

```ts
export function toSearch(f: Filters, defaults = {}, current = '') {
  const p = new URLSearchParams(current)
  FILTER_KEYS.forEach((key) => p.delete(key))
  if (f.rooms.length) p.set('rooms', f.rooms.join(','))
  if (!sameRange(f.price, defaults.price)) p.set('price', f.price!.join('-'))
  …
}
```

- Пишем **только отличия от умолчаний**: ссылка короткая (`/flats/?rooms=2`), а не все параметры.
- **`current` — чужие параметры сохраняются.** Сначала удаляем только свои ключи, остальное
  (например, `?view=chess` — выбранный таб «Список / Шахматка») остаётся. Без этого фильтр стирал
  выбор таба, и после перезагрузки открывался не тот.

## Модуль каталога

```ts
const flats: Flat[] = JSON.parse(root.querySelector('[data-catalog-data]')?.textContent ?? '[]')
```

Все квартиры уже лежат в странице: `<script type="application/json">` — его браузер не
выполняет, это просто данные. Отдельный запрос не нужен.

```ts
function read(): Filters {
  const data = new FormData(form)
  return {
    rooms: data.getAll('rooms').map(Number),
    price: rangeOf('price'),
    tower: Number(data.get('tower')) || null,
    onlyFree: data.get('onlyFree') === 'on',
    …
  }
}
```

`FormData` собирает всю форму одним вызовом; `getAll` — все отмеченные чекбоксы с одним именем.

```ts
function apply({ resetPage = true } = {}) {
  const f = read()
  result = applyFilters(flats, f)
  if (resetPage) shown = PAGE
  const ids = new Set(result.map((x) => x.id))
  cells.forEach((cell) => cell.classList.toggle('is-match', ids.has(cell.dataset.flatCell ?? '')))
  counters.forEach((c) => (c.textContent = `${result.length} ${plural(result.length, ['квартира', 'квартиры', 'квартир'])}`))
  renderList()
  history.replaceState(history.state, '', `${location.pathname}${toSearch(f, defaults, location.search)}${location.hash}`)
}
```

- **Шахматка не перерисовывается**: она собрана при сборке, модуль лишь ставит класс `is-match`
  подходящим ячейкам. `Set` — проверка «подходит ли» за одно обращение вместо поиска по массиву.
- Склонение: 1 квартира, 2 квартиры, 5 квартир.
- **`replaceState`** — адрес меняется, а история нет.

```ts
const applyDebounced = debounce(() => apply(), 120)
d.listen(form, 'input', applyDebounced)
d.listen(form, 'change', applyDebounced)
d.listen(form, 'reset', () => setTimeout(() => apply()))
```

- `debounce(120)` — ползунок шлёт десятки `input` в секунду; пересчёт — через 120 мс после
  последнего.
- `reset` приходит **до** очистки полей — ждём тик.

```ts
requestAnimationFrame(() => {
  write({ ...EMPTY, ...fromSearch(location.search) })
  apply()
})
```

Модули ползунков (`range`) и выпадающих списков (`select`) кита запускаются параллельно с
каталогом. Ждём кадр — к этому моменту их обработчики уже на месте, и `write` правильно
перерисует ползунки.

## Что будет, если…

| Сделать | Что сломается |
| --- | --- |
| `pushState` | «Назад» перебирает каждое движение ползунка |
| `toSearch` без `current` | после фильтра пропадает выбранный таб `?view=chess` |
| без `debounce` | при движении ползунка — пересчёт и перерисовка десятки раз в секунду |
| без `requestAnimationFrame` при старте | ползунки из адреса не отрисовываются |

## Проверьте себя

1. Почему данные квартир в `<script type="application/json">`, а не отдельным запросом?
2. Что значит `?status=all` и почему нет `?status=free`?

<details>
<summary>Ответы</summary>

1. Они нужны сразу; лишний запрос — лишняя задержка и ещё одно состояние «загрузка / ошибка». Браузер
   не выполняет такой `<script>` — это просто данные.
2. По умолчанию показываются только свободные — умолчание в адрес не пишется. `all` — отличие от
   умолчания.
</details>
