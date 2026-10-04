# Стили (SCSS)

## Как подключено

```scss
// src/styles/main.scss — ПОРЯДОК ВАЖЕН
@use 'abstracts'; // 1. настройки проекта (цвета, шрифты…) — до кита
@use 'kit/scss'; // 2. CSS кита: переменные, сброс, типографика, компоненты
@use 'layout'; // 3. стили проекта
@use 'sections/hero';
```

```scss
// любой другой файл проекта
@use 'abstracts' as *;

.card {
  padding: space(6);
  border-radius: radius('lg');
  @include up('md') {
    padding: space(10);
  }
}
```

`abstracts` не выводит CSS — только переменные, функции, миксины. Подключайте его в каждом
файле: дублирования не будет.

## Настройки проекта

`src/styles/_abstracts.scss`:

```scss
@forward 'kit/scss/abstracts' with (
  $colors: (
    'accent': #ff5a1f,
    'accent-contrast': #fff,
  ),
  $colors-dark: (
    'accent': #ff8a5c,
  ),
  $breakpoints: (
    'xl': 1200px,
  ),
  $font-base: (
    'Manrope',
    system-ui,
    sans-serif,
  ),
  $container-max: 1200px
);

// Свои миксины/функции проекта — ниже, в этом же файле.
@mixin card-shadow {
  box-shadow: var(--shadow-md);
}
```

Карты (`$colors`, `$breakpoints`, `$z-layers`) **сливаются** с умолчаниями — указывайте
только изменения. Все настройки — `kit/scss/_config.scss`.

## Функции

| Функция                         | Пример              | Результат                                         |
| ------------------------------- | ------------------- | ------------------------------------------------- |
| `rem($px)`                      | `rem(24px)`         | `1.5rem`                                          |
| `space($n)`                     | `space(4)`          | `1rem` (шаг 4px)                                  |
| `fluid($min, $max, $from, $to)` | `fluid(28px, 56px)` | `clamp(…)`: 28px на 360px экрана → 56px на 1440px |
| `color($name)`                  | `color('accent')`   | `var(--color-accent)` (ошибка при опечатке)       |
| `z($layer)`                     | `z('header')`       | `200`                                             |
| `radius($name)`                 | `radius('md')`      | `var(--radius-md)`                                |
| `bp($name)`                     | `bp('md')`          | `768px`                                           |

## Миксины

| Миксин                                          | Для чего                                                    |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `up('md')`, `down('md')`, `between('md', 'lg')` | медиазапросы (mobile-first)                                 |
| `hover { … }`                                   | hover только при мыши (без «залипания» на тач-экранах)      |
| `hocus { … }`                                   | hover + фокус с клавиатуры                                  |
| `motion { … }`                                  | анимации только если пользователь не просил меньше движения |
| `visually-hidden`                               | скрыть, оставив для скринридеров                            |
| `line-clamp(3)`                                 | обрезать текст до N строк                                   |
| `focus-ring`                                    | видимое кольцо фокуса                                       |
| `reset-button`, `reset-list`                    | сброс стилей кнопки/списка                                  |
| `container`, `full-bleed`                       | контейнер / «на всю ширину» изнутри контейнера              |
| `scrollbar-hidden`, `cover`, `object-cover`     | прочее                                                      |

## CSS-переменные

На `:root`: `--color-*`, `--bp-*`, `--radius-*`, `--shadow-*`, `--font-base/heading/mono`,
`--ease`, `--duration`, `--container-padding`, `--container-max`, `--grid-gap`,
`--header-height` (ставит модуль `sticky-header`), `--scrollbar-width` (при блокировке прокрутки).

## Тёмная тема

Цвета `$colors-dark` применяются при `data-theme="dark"` на `<html>` или, если пользователь
ничего не выбрал, по системной настройке. Пишите цвета только через `var(--color-…)` —
тогда тёмная тема работает без единой строчки в стилях блоков.

## Утилиты-классы

`.container`, `.section`, `.stack` (`--gap`), `.cluster`, `.auto-grid` (`--min`), `.full-bleed`,
`.cover`, `.line-clamp-2/3`, `.visually-hidden`, `.skip-link`, `.prose` (текст из CMS),
`.h1…h4`, `.lead`, `.small`, `.muted`. Кнопки: `.btn`, `.btn--secondary`, `.btn--ghost`, `.btn--sm/lg`.

## Именование — БЭМ

`.block`, `.block__element`, `.block--modifier`; состояния — `.is-open`, `.is-active`
(их ставит JS). Stylelint проверяет имена классов. Один блок — один файл.

## Шрифты

```bash
npm i @fontsource-variable/manrope
```

```js
// src/main.js
import '@fontsource-variable/manrope'
```

```scss
$font-base: ('Manrope Variable', system-ui, sans-serif);
```

Свои файлы шрифтов — в `public/fonts/` + `@font-face` с `font-display: swap`.
