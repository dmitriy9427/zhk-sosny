# Быстрый старт

## 1. Создать проект

Из папки шаблона:

```bash
npm run create -- ../my-site --stack vanilla      # вёрстка: HTML-страницы + JS-модули
npm run create -- ../my-app --stack react         # React-приложение (JS)
npm run create -- ../my-app --stack react-ts      # React + TypeScript
npm run create -- ../my-site --stack astro        # Astro: статический сайт, языки, SEO
npm run create                                    # спросит папку и стек сам
```

Дополнительно: `--install` (сразу `npm install`), `--git` (git init + первый коммит),
`--name my-site` (имя в package.json).

Получается **самостоятельный** проект: своя копия `kit/`, свой `package.json` только с нужными
пакетами, линтеры, тесты, документация. Шаблон ему больше не нужен.

> Какой стек выбрать:
>
> - вёрстка под CMS (Битрикс, WordPress, Django-шаблоны), промо — **vanilla**;
> - сайт, где важны скорость и SEO, несколько языков, портфолио, блог — **astro**;
> - личный кабинет, дашборд, много состояния на клиенте — **react-ts** (или **react** без TS).

## 2. Запустить

```bash
cd ../my-site
npm install
npm run dev          # http://localhost:5173
```

| Команда                        | Что делает                                                            |
| ------------------------------ | --------------------------------------------------------------------- |
| `npm run dev`                  | Сервер разработки с перезагрузкой при сохранении, мок-API, dev-панель |
| `npm run build`                | Готовый сайт в `dist/`                                                |
| `npm run preview`              | Посмотреть собранный `dist/`                                          |
| `npm test`                     | Тесты (`npm run test:watch` — перезапуск при сохранении)              |
| `npm run lint` / `npm run fix` | Проверить / автоматически поправить JS и SCSS                         |
| `npm run check`                | Линтеры + тесты + сборка — **запускайте перед сдачей**                |

## 3. Настроить «лицо» проекта

`src/styles/_abstracts.scss` — цвета, шрифты, брейкпоинты, ширина контейнера:

```scss
@forward 'kit/scss/abstracts' with (
  $colors: (
    'accent': #ff5a1f,
    'bg': #fffaf5,
  ),
  $font-base: (
    'Inter',
    system-ui,
    sans-serif,
  )
);
```

Указывайте только то, что меняете, — остальное останется по умолчанию. Все настройки с
пояснениями — `kit/scss/_config.scss`. Подробно — [styles.md](styles.md).

## 4. Первая страница (vanilla)

Создайте `about.html` в корне — она сама попадёт в сборку:

```html
<!doctype html>
<html lang="ru">
  <head>
    <include src="head.html" title="О компании" description="Кто мы"></include>
  </head>
  <body>
    <include src="header.html"></include>
    <main id="main" class="container section" data-module="reveal">
      <h1 data-reveal>О компании</h1>
    </main>
    <include src="footer.html"></include>
  </body>
</html>
```

`<include>` вставляет кусок из `partials/`. Ссылка на текущую страницу в меню получит
`aria-current="page"` сама.

## 5. Первый модуль

```bash
cp -r src/modules/hello src/modules/price-calc
```

```js
// src/modules/price-calc/index.js
import { createDisposer } from 'kit/js/core/lifecycle.js'
import { readOptions } from 'kit/js/core/options.js'

const DEFAULTS = { rate: 1500 }

export default function priceCalc(el, ctx = {}) {
  const options = readOptions(el, 'price-calc', DEFAULTS, ctx.options)
  const d = createDisposer()
  const input = el.querySelector('input')
  const out = el.querySelector('output')
  d.listen(input, 'input', () => (out.value = Number(input.value) * options.rate))
  return { destroy: d.dispose }
}
```

```js
// src/modules/index.js
export const projectModules = {
  hello: lazy(() => import('./hello/index.js')),
  'price-calc': lazy(() => import('./price-calc/index.js')),
}
```

```html
<div data-module="price-calc" data-price-calc-rate="2000"><input type="number" /> × 2000 = <output></output> ₽</div>
```

Контракт модуля и все правила — [modules.md](modules.md#свой-модуль).

## 6. Dev-панель

В `npm run dev` слева внизу кнопка ⚙ (или Shift+Alt+K): сетка, текущий брейкпоинт, FPS,
контуры блоков, поиск того, что вылезает за экран, проверка доступности, наложение макета.
В сборку панель не попадает. Подробно — [devtools.md](devtools.md).

## 7. Перед сдачей

`npm run check` и [checklist.md](checklist.md).
