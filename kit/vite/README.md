# vite — плагины сборки

| Файл                 | Плагин                                                                                        | Где работает |
| -------------------- | --------------------------------------------------------------------------------------------- | ------------ |
| `html-components.js` | `<x-компоненты>`, `{{ выражения }}`, `x-for`/`x-if`, слоты, данные, `<include>`, aria-current | dev + build  |
| `html-include.js`    | старое имя того же плагина (совместимость)                                                    |              |
| `svg-sprite.js`      | `src/icons/*.svg` → встроенный спрайт, только используемые иконки                             | dev + build  |
| `pages.js`           | все `.html` корня — страницы сборки                                                           | build        |
| `mock-api.js`        | `/api/*` → `mocks/*.js`                                                                       | только dev   |
| `devtools-guard.js`  | сборка падает, если dev-панель в бандле                                                       | только build |
| `index.js`           | `kit({ include, icons, pages, mocks })` — всё вместе                                          |              |

Подробно: компоненты — [docs/components.md](../../docs/components.md), иконки —
[docs/icons.md](../../docs/icons.md), остальное — [docs/devtools.md](../../docs/devtools.md#vite-плагины-kitvite).
Тесты — `html-components.test.js`, `vite.test.js`.
