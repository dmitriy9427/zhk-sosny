# 05. Деплой на GitHub Pages

Сайт живёт в подпапке `https://dmitriy9427.github.io/zhk-sosny/`.

- `astro.config.mjs`: `base` берётся из окружения сборки, `site` — домен.
- Astro и Vite сами добавляют base к своим файлам (CSS, JS, шрифты). Ссылки в
  разметке и строках — наша забота: все пути идут через `withBase('/flats/')`
  из `lib/base.ts`. Включая `cardHtml`, 3D-модуль (переход к каталогу башни) и
  планировки.
- Все страницы — настоящие файлы (`flats/1-5-3/index.html`), поэтому прямые
  ссылки работают без хитростей с `404.html`.

## Самый маленький пример: путь с учётом подпапки

```ts
// src/lib/base.ts
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
export const withBase = (path: string) => `${BASE}${path.startsWith('/') ? path : `/${path}`}`

withBase('/flats/')   // локально: '/flats/', на Pages: '/zhk-sosny/flats/'
```

`BASE_URL` Astro берёт из настройки `base` в `astro.config.mjs` (её задаёт сборка для Pages).

## Ошибки

> **Ссылки `href="/flats/"` в разметке и строках.** На Pages сайт живёт в `/zhk-sosny/` — 404.
> Через `withBase`.
>
> **Забыть про строки в JS.** `cardHtml`, 3D-модуль, планировки — везде, где путь собирается
> строкой, Astro его не поправит.

## Попробуйте сами

1. Почему здесь не нужен трюк с `404.html`, как у SPA?

<details>
<summary>Ответы</summary>

1. Все страницы — настоящие файлы (`flats/1-5-3/index.html`). Прямая ссылка отдаёт существующий
   файл, роутер в браузере не нужен.
</details>
