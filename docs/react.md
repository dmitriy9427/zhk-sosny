# React

React-стартер использует **те же модули кита**, что и вёрстка: разметку рисует React,
поведение (aria, клавиатура, анимации, адрес) — модуль.

## Подключение

```jsx
// src/main.jsx — KitProvider: шина событий, плавный скролл, reduced motion
<StrictMode>
  <KitProvider smooth>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </KitProvider>
</StrictMode>
```

## useModule

```jsx
import { useModule } from 'kit/react/index.js'
import accordion from 'kit/js/modules/accordion/index.js'

function Faq({ items }) {
  const ref = useModule(accordion, { multiple: true })
  return (
    <div ref={ref} className="accordion">
      {/* разметка как в modules.md */}
    </div>
  )
}
```

Доступ к API модуля — третий аргумент:

```jsx
const api = useRef(null)
const ref = useModule(dialog, undefined, (instance) => (api.current = instance))
<button onClick={() => api.current?.open()}>Открыть</button>
```

### Правила

1. **Опции** сравниваются по значению; объекты и функции внутри — по ссылке. Схемы форм,
   `onSubmit` — объявляйте вне компонента или в `useMemo`/`useCallback`.
2. **Не пишите в JSX атрибуты, которыми управляет модуль** (`aria-expanded`, `hidden`,
   `aria-selected`…): React их перезапишет.
3. **Сменился состав элементов** (слайды, пункты) — перезапустите модуль: `key={items.length}`.
4. **StrictMode** монтирует дважды — модули к этому готовы. Свой модуль обязан убирать всё в `destroy`.

## Хуки

| Хук                                    | Что возвращает                                         |
| -------------------------------------- | ------------------------------------------------------ |
| `useKit()`                             | `{ bus, scroll, reduced }`                             |
| `useBus('menu:toggle', fn)`            | подписка на шину (без переподписки при каждом рендере) |
| `useMediaQuery('(min-width: 1024px)')` | true/false, обновляется                                |
| `useBreakpoint('lg')`                  | экран шире брейкпоинта из SCSS                         |
| `useReducedMotion()`                   | пользователь просил меньше анимаций                    |

Все хуки безопасны для SSR (Next.js, Astro): на сервере — значение по умолчанию.

## GSAP в компонентах

```jsx
import { useEffect, useRef } from 'react'
import { gsap } from 'kit/js/core/gsap.js'

function Hero() {
  const root = useRef(null)
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero__title', { y: 40, opacity: 0 })
    }, root) // селекторы ищутся только внутри root
    return () => ctx.revert() // убрать анимации и inline-стили при размонтировании
  }, [])
  return <section ref={root}>…</section>
}
```

## Маршруты

`src/App.jsx`: `<Route path="/about" element={<About />} />`. Редкие страницы — `lazy(() => import(…))`.
`useRouteReset` сбрасывает прокрутку и пересчитывает ScrollTrigger при смене адреса.
Хостинг должен отдавать `index.html` на любой путь — [deploy.md](deploy.md).

## Перенос в Next.js / Astro

Скопируйте `kit/` в проект, alias `kit` → папка кита, SCSS `loadPaths` → родитель `kit` и
`src/styles`. В Next.js компоненты с `useModule` — с `'use client'`. В Astro — React-острова
(`client:visible`) или обычный `<script>` с `createApp` для статических страниц.
