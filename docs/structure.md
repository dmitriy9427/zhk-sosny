# Структура

## Шаблон (эта папка)

```
frontend-kit/
├── kit/                 ← ОБЩИЙ КИТ — копируется в каждый проект
│   ├── js/core/         ← ядро: запуск модулей, уборка, шина, опции, скролл, адрес, утилиты
│   ├── js/modules/      ← готовые модули: accordion, tabs, dialog, form, slider…
│   ├── js/form/         ← формы: схемы проверки, маски, сбор значений
│   ├── js/i18n/         ← тексты кита на русском и английском
│   ├── types/           ← глобальные типы для TypeScript
│   ├── scss/            ← стили: настройки, функции, миксины, база, компоненты
│   ├── react/           ← React: useModule, KitProvider, хуки (только в React-проектах)
│   ├── devtools/        ← dev-панель (только в разработке)
│   └── vite/            ← Vite-плагины: include, страницы, мок-API, защита прода
├── starters/
│   ├── vanilla/         ← вёрстка: index.html, ui-kit.html, effects.html, partials/, src/
│   ├── react/           ← React (JS): src/App.jsx, pages/, components/
│   ├── react-ts/        ← React + TypeScript (strict)
│   └── astro/           ← Astro: ru + en, SEO, sitemap, TypeScript
├── scripts/create.mjs   ← создание проекта и обновление кита
├── test/                ← настройка тестов и помощники
└── docs/                ← эта документация
```

В шаблоне стартеры запускаются прямо отсюда: `npm run dev` (vanilla), `npm run dev:react`,
`npm run dev:react-ts`, `npm run dev:astro`.
Так кит разрабатывается и проверяется на живых страницах.

## Проект (после `npm run create`)

```
my-site/
├── index.html, ui-kit.html, 404.html, privacy.html   ← страницы (vanilla)
├── partials/            ← куски HTML: head, header, footer, модалки
├── src/
│   ├── main.js          ← точка входа: стили, запуск модулей, dev-панель
│   ├── modules/         ← модули ЭТОГО проекта (+ index.js — реестр)
│   ├── forms/schemas.js ← схемы форм проекта
│   └── styles/          ← _abstracts.scss (настройки), main.scss, стили блоков
├── mocks/               ← фейковый API: mocks/callback.js → POST /api/callback
├── public/              ← файлы как есть: favicon, robots.txt, картинки без обработки
├── kit/                 ← копия кита
├── test/, docs/
└── vite.config.js, eslint.config.js, stylelint.config.js, vitest.config.js
```

## Что где менять

| Хочу                                    | Где                                                          |
| --------------------------------------- | ------------------------------------------------------------ |
| Цвета, шрифты, брейкпоинты              | `src/styles/_abstracts.scss`                                 |
| Стили блока                             | `src/styles/…` — свой файл на блок, подключить в `main.scss` |
| Шапка, подвал, `<head>`                 | `partials/` (vanilla), `src/components/` (React)             |
| Новое поведение                         | `src/modules/<имя>/` + строка в `src/modules/index.js`       |
| Правила формы                           | `src/forms/schemas.js`                                       |
| Ответ API в разработке                  | `mocks/<путь>.js`                                            |
| Поведение модуля кита для ЭТОГО проекта | см. ниже                                                     |

## Можно ли править kit/ в проекте

Можно — это ваша копия. Но тогда `npm run create -- --update` (обновление кита из шаблона)
перезапишет правки. Порядок, который не создаёт проблем:

1. **Настройки** — через атрибуты/опции (`data-slider-autoplay`, `ctx.options`), не правкой кода.
2. **Другое поведение** — свой модуль в `src/modules/` с тем же именем: модули проекта
   подключаются после модулей кита и заменяют их (`{ ...kitModules, ...projectModules }`).
3. **Баг в ките** — исправьте в шаблоне, затем обновите проекты:
   ```bash
   cd frontend-kit
   npm run create -- --update ../my-site
   cd ../my-site && git diff kit/      # посмотреть, что изменилось
   ```

## Почему кит копируется, а не ставится npm-пакетом

Фриланс-проекты живут годами независимо: проект трёхлетней давности не должен сломаться
от обновления пакета, а заказчику или другому разработчику проще получить всё в одной папке.
Обновление — осознанное, командой `--update`, с просмотром `git diff`.
