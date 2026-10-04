# test — настройка тестов

`setup.js` — заглушки браузерных API для jsdom (matchMedia, IntersectionObserver,
ResizeObserver, `<dialog>`) и очистка после каждого теста.
`helpers.js` — `html`, `createCtx`, `key`, `tick`, `setSize`. Подключение: `import … from '@test/helpers.js'`.
Руководство — [docs/testing.md](../docs/testing.md).
