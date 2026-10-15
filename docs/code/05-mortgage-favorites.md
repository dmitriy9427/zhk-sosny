# 5. Ипотека и избранное

[src/lib/mortgage.ts](../../src/lib/mortgage.ts), [src/modules/mortgage/index.ts](../../src/modules/mortgage/index.ts),
[src/modules/favorites/index.ts](../../src/modules/favorites/index.ts)

## Где на экране

**Калькулятор** на странице квартиры и главной: стоимость, программа (семейная, IT, базовая,
рассрочка), взнос, срок → «Платёж 42 986 ₽ в месяц», сумма кредита, переплата, рекомендуемый доход.

**Избранное**: ♥ на карточках и странице квартиры, счётчик в шапке, страница «Избранное».

## Ипотека: формула

```ts
export function calcMortgage({ price, down, rate, years }) {
  const loan = Math.max(0, price - down)
  const n = Math.max(1, Math.round(years * 12))
  const r = rate / 12 / 100
  const monthly = r === 0 ? loan / n : (loan * (r * (1 + r) ** n)) / ((1 + r) ** n - 1)
  const total = monthly * n
  return { loan, monthly: Math.round(monthly), total: Math.round(total), overpayment: Math.round(total - loan), income: Math.round(monthly * 2) }
}
```

Аннуитетный платёж — **одинаковый** каждый месяц: в начале в нём больше процентов, в конце —
больше долга.

| Величина | Смысл |
| --- | --- |
| `r` | ставка в месяц: 6 % годовых → 0,005 |
| `n` | число платежей: 20 лет → 240 |
| `(1 + r)ⁿ` | во сколько раз вырос бы долг без платежей |

- `Math.max(0, …)` — взнос больше цены не даёт отрицательный кредит.
- `Math.max(1, …)` — срок 0 не даёт деления на ноль.
- **`r === 0`** — рассрочка без процентов: формула дала бы `0 / 0 = NaN`, поэтому отдельная ветка.
- Доход — платёж не больше половины (`× 2`): так считают банки для одобрения.

```ts
export const minDown = (price, percent) => Math.ceil((price * percent) / 100 / 10_000) * 10_000
```

Минимальный взнос округляется **вверх до 10 000 ₽** — красивое число и не меньше требования.

## Модуль калькулятора

```ts
function update() {
  const program = mortgagePrograms.find((p) => p.id === programId) ?? mortgagePrograms[0]
  downInput.min = String(program.minDown)
  if (Number(downInput.value) < program.minDown) downInput.value = String(program.minDown)
  yearsInput.max = program.rate === 0 ? '2' : '30'
  if (Number(yearsInput.value) > Number(yearsInput.max)) yearsInput.value = yearsInput.max
  …
}
```

**Правила программы — в форме.** Выбрали рассрочку (минимум 30 %, до 2 лет) — ползунок взноса
поднимается до 30 %, ползунок срока упирается в 2 года. Человек не может собрать невозможный
вариант.

```ts
const animate = (key, value, format) => {
  const state = { v: shown[key] ?? value }
  shown[key] = value
  gsap.to(state, { v: value, duration: ctx.reduced ? 0 : 0.5, ease: 'power2.out', overwrite: true,
    onUpdate: () => (el.textContent = format(state.v)) })
}
```

Число «набегает» от старого значения к новому: GSAP анимирует обычное число, `onUpdate` пишет
его в текст. `overwrite: true` — при быстром движении ползунка анимации не спорят. «Меньше
движения» — длительность 0.

```ts
form.querySelectorAll('input[type="range"]').forEach((input) => {
  input.style.setProperty('--fill', `${((Number(input.value) - min) / span) * 100}%`)
})
```

Заливка ползунка слева от ручки — CSS-переменная, CSS рисует градиент. Нативный `<input
type="range">` так не умеет одинаково во всех браузерах.

## Избранное

```ts
export const getFavorites = (): string[] => {
  const value = readStorage(KEY, [])
  return Array.isArray(value) ? value : []
}

export function toggleFavorite(id: string): boolean {
  const list = getFavorites()
  const on = !list.includes(id)
  writeStorage(KEY, on ? [...list, id] : list.filter((x) => x !== id))
  document.dispatchEvent(new CustomEvent('favorites:change'))
  return on
}
```

Список id в `localStorage`. `Array.isArray` — в хранилище может лежать что угодно (старая версия,
правка руками). После изменения — событие, чтобы обновились все кнопки страницы.

```ts
export default function favorites(root: HTMLElement) {
  const d = createDisposer()
  d.add(delegate(root, 'click', '[data-favorite]', (event, button) => {
    event.preventDefault()
    event.stopPropagation()
    const on = toggleFavorite(button.dataset.favorite ?? '')
    toast(on ? 'Добавлено в избранное' : 'Убрано из избранного', { … })
  }))
  d.listen(document, 'favorites:change', () => syncFavorites())
  d.listen(document, 'catalog:render', () => syncFavorites())
  d.listen(window, 'storage', (event) => event.key === KEY && syncFavorites())
  syncFavorites()
}
```

- Модуль на `<body>` — **один** обработчик для всех ♥ страницы, включая карточки, которые каталог
  нарисует позже.
- `preventDefault` + `stopPropagation` — ♥ лежит поверх ссылки-карточки: клик не должен увести на
  страницу квартиры.
- Три повода перерисовать: своё изменение, каталог дорисовал карточки, другая вкладка изменила
  хранилище (`storage`).

```ts
button.setAttribute('aria-pressed', String(on))
button.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное')
```

`aria-pressed` — кнопка-переключатель: скринридер скажет «В избранное, кнопка, нажата».

## Что будет, если…

| Сделать | Что сломается |
| --- | --- |
| без ветки `r === 0` | у рассрочки «NaN ₽» |
| не ограничивать срок рассрочки | калькулятор считает невозможный вариант «рассрочка на 30 лет» |
| обработчик на каждую ♥ | у карточек после фильтра сердечки не работают |
| без `stopPropagation` | клик по ♥ открывает страницу квартиры |

## Проверьте себя

1. Цена 10 000 000 ₽, программа «Рассрочка» (минимум 30 %). Какой будет минимальный взнос?
2. Почему избранное синхронизируется событием `favorites:change`, а не прямым вызовом из кнопки?

<details>
<summary>Ответы</summary>

1. `ceil(10 000 000 × 30 / 100 / 10 000) × 10 000 = 3 000 000 ₽`.
2. ♥ одной квартиры бывает в нескольких местах страницы (карточка в «Похожих», кнопка на
   странице) и счётчик в шапке. Событие обновляет всех; кнопке не нужно знать про остальных.
</details>
