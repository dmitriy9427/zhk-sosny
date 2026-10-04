# Тесты

Vitest + jsdom (браузер в памяти, без вёрстки). Тест лежит рядом с кодом: `module.test.js`.

```bash
npm test             # один раз
npm run test:watch   # перезапуск при сохранении
npm run coverage     # отчёт о покрытии в coverage/index.html
```

## Шаблон теста модуля

```js
import { describe, expect, it, vi } from 'vitest'
import myModule from './index.js'
import { createCtx, html, key, tick, setSize } from '@test/helpers.js'

describe('my-module', () => {
  it('делает то, что обещает', () => {
    const el = html('<div data-my-module-speed="2"><button data-my-module-button>Go</button></div>')
    const api = myModule(el, createCtx())
    el.querySelector('button').click()
    expect(el.classList.contains('is-active')).toBe(true)
    api.destroy()
  })
})
```

## Помощники

| Помощник                                                   | Что делает                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `html('<div>…</div>')`                                     | вставить разметку, вернуть первый элемент (после теста документ очищается) |
| `createCtx({ reduced: false })`                            | контекст модуля с шиной; по умолчанию `reduced: true` — без анимаций       |
| `key(el, 'ArrowRight')`                                    | нажатие клавиши                                                            |
| `tick(ms)`                                                 | подождать (промисы, таймеры)                                               |
| `setSize(el, { width, height })`                           | задать размеры (в jsdom они всегда 0)                                      |
| `setMedia({ '(hover: hover) and (pointer: fine)': true })` | управлять matchMedia                                                       |
| `triggerIntersect(el, true)`                               | «показать» элемент на экране (IntersectionObserver)                        |

После каждого теста сбрасываются документ, классы `<html>`, адрес, медиазапросы.

## Что тестировать

- **Чистые функции** (расчёты, форматирование, схемы) — всегда, это дёшево.
- **Модули** — поведение: клики, клавиатура, aria-атрибуты, события, `destroy` убирает всё.
- **Не тестируйте** пиксели и плавность анимации — это проверяется глазами в браузере
  (и dev-панелью). Для визуальных проверок можно подключить Playwright.

## Окружение node

SCSS, Vite-плагины и скрипты тестируются без браузера — первой строкой комментария файла:

```js
/** @vitest-environment node */
```
