# vite — плагины сборки

| Файл                | Плагин                                                  | Где работает |
| ------------------- | ------------------------------------------------------- | ------------ |
| `html-include.js`   | `<include src="…">` + `{{ переменные }}` + aria-current | dev + build  |
| `pages.js`          | все `.html` корня — страницы сборки                     | build        |
| `mock-api.js`       | `/api/*` → `mocks/*.js`                                 | только dev   |
| `devtools-guard.js` | сборка падает, если dev-панель в бандле                 | только build |
| `index.js`          | `kit({ include, pages, mocks })` — всё вместе           |              |

Подробно — [docs/devtools.md](../../docs/devtools.md#vite-плагины-kitvite). Тесты — `vite.test.js`.
