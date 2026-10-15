# 3. Страницы и карточки при сборке

[src/pages/flats/[id].astro](../../src/pages/flats/[id].astro), [src/lib/card.ts](../../src/lib/card.ts),
[src/pages/plans/[layout].svg.ts](../../src/pages/plans/[layout].svg.ts), [src/lib/plan.ts](../../src/lib/plan.ts)

## Где на экране

Страница квартиры `/flats/1-5-3/`: заголовок «2-комнатная, 58,4 м²», цена, планировка, параметры,
соседи по этажу, калькулятор ипотеки, «Похожие квартиры». И карточки в списке каталога — с
картинкой планировки.

## 270 страниц из одного файла

```astro
---
export function getStaticPaths() {
  return FLATS.map((flat) => ({ params: { id: flat.id }, props: { flat } }))
}
const { flat } = Astro.props as { flat: Flat }
const title = flatTitle(flat)
const similar = FLATS.filter((f) => f.id !== flat.id && f.rooms === flat.rooms && f.status === 'free')
  .sort((a, b) => Math.abs(a.price - flat.price) - Math.abs(b.price - flat.price))
  .slice(0, 3)
---
<Base title={`${title}, ${formatPrice(flat.price)} — квартал «Сосны»`} description={…}>
```

- Квадратные скобки в имени файла `[id]` — **параметр**. `getStaticPaths` говорит Astro, какие
  значения он принимает, и даёт каждой странице её данные (`props`).
- При сборке получается 270 файлов `flats/<id>/index.html` — у каждого **свой** `<title>` и
  описание для поисковиков.
- «Похожие» — той же комнатности, свободные, **ближайшие по цене**: сортировка по модулю разницы.
  Всё считается при сборке — у посетителя ноль вычислений.

## Одна карточка для сборки и браузера

Карточки нужны в двух местах:

| Где | Кто рисует | Когда |
| --- | --- | --- |
| «Похожие» на странице квартиры | Astro | при сборке |
| список каталога | модуль `catalog` | в браузере, после каждого фильтра |

Две вёрстки разъехались бы при первой правке. Поэтому одна функция возвращает **строку HTML**:

```ts
export function cardHtml(f: Flat) {
  return `<article class="flat-card flat-card--${f.status}" data-flat="${f.id}">
  <a class="flat-card__link" href="${withBase(`/flats/${f.id}/`)}" aria-label="${flatTitle(f)}, ${formatPrice(f.price)}"></a>
  <div class="flat-card__plan"><img src="${withBase(`/plans/${f.layout}.svg`)}" alt="" width="300" height="200" loading="lazy" decoding="async"></div>
  …
  <button class="flat-card__fav fav-button" type="button" data-favorite="${f.id}" aria-label="В избранное" aria-pressed="false">♥</button>
</article>`
}
```

```astro
<!-- Astro -->
<div class="catalog__list" set:html={similar.map(cardHtml).join('')} />
```

```ts
// модуль каталога
list.innerHTML = result.slice(0, shown).map(cardHtml).join('')
```

Детали карточки:

- **Ссылка-«накладка»** (`flat-card__link` растянута на всю карточку через CSS) — кликается вся
  карточка, а кнопка ♥ остаётся отдельной кнопкой поверх неё (вложить кнопку в ссылку нельзя).
- `aria-label` у ссылки — короткое имя для скринридера: «2-комнатная, 58,4 м², 9 500 000 ₽»,
  а не весь текст карточки подряд.
- У картинки `alt=""` — планировка декоративна, всё важное уже в тексте.
- `width`/`height` — место под картинку зарезервировано, карточки не прыгают при загрузке.
- `loading="lazy"` — картинки ниже экрана грузятся по мере прокрутки.

**Почему HTML-строкой безопасно.** В строку подставляются только **наши** данные (из `flats.ts`).
Если бы туда попадал текст от людей (отзыв, имя), строка открыла бы дорогу XSS — тогда только
`textContent` или экранирование.

## Планировки — кодом, четыре файла на всех

```ts
// pages/plans/[layout].svg.ts
export const getStaticPaths = () => Object.keys(PLANS).map((layout) => ({ params: { layout } }))

export const GET: APIRoute = ({ params }) =>
  new Response(planSvg(params.layout as Layout), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } })
```

Это **эндпоинт**: файл в `pages/`, который отдаёт не HTML, а то, что вернёт `GET`. При статической
сборке Astro вызывает его для каждого параметра и сохраняет результат файлами: `/plans/studio.svg`,
`one.svg`, `two.svg`, `three.svg`.

Почему так: 270 карточек ссылаются на **4** файла — браузер скачает каждый один раз и возьмёт из
кеша. Встроить SVG в каждую карточку — 270 копий в HTML.

`planSvg` рисует комнаты из прямоугольников «в клетках» (1 клетка ≈ 10 см): стены, подписи,
площади, окна и двери. На странице квартиры тот же SVG встраивается прямо в HTML — с **её**
точной площадью.

## Что будет, если…

| Сделать | Что сломается |
| --- | --- |
| карточка в двух вёрстках | после правки цвета статуса карточки каталога и «Похожих» разные |
| кнопка ♥ внутри `<a>` | недопустимый HTML, клик по сердечку уводит на страницу квартиры |
| SVG планировки внутри каждой карточки | HTML каталога тяжелеет в десятки раз |
| `<img>` без размеров | карточки прыгают, пока грузятся картинки |

## Проверьте себя

1. Сколько HTML-файлов квартир в `dist/` и как их посчитать?
2. Почему у ссылки карточки свой `aria-label`?

<details>
<summary>Ответы</summary>

1. 270: `find dist/flats -name index.html | wc -l` (плюс сам каталог `dist/flats/index.html`).
2. Без него скринридер прочитал бы весь текст карточки как имя ссылки — длинно и с повторами.
</details>
