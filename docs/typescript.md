# TypeScript

## Как устроено

| Стек           | Как работает TypeScript                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vanilla, react | Код на JS, типы — в JSDoc-комментариях. `checkJs` проверяет их: редактор подсказывает и подчёркивает ошибки, `npm run typecheck` проверяет весь проект. Сборка не меняется. |
| react-ts       | Свой код — `.ts/.tsx` в строгом режиме (`strict`). Кит остаётся JS — типы берутся из его JSDoc.                                                                             |
| astro          | `.astro` и `.ts` в строгом режиме, проверка — `astro check`.                                                                                                                |

Кит написан на JS с JSDoc намеренно: его можно взять в любой проект (в том числе в вёрстку
под CMS без сборки TypeScript), а подсказки типов в редакторе есть везде.

## Команды

```bash
npm run typecheck   # проверка типов (входит в npm run check)
```

## Типы модулей в React-TS

```tsx
const ref = useModule<HTMLDivElement>(accordion, { multiple: true })
return <div ref={ref}>…</div>
```

CSS-переменные в `style` разрешены (`kit/types/global.d.ts`): `style={{ '--gap': '24px' }}`.

## Почему TypeScript 6, а не 7

TypeScript 7 — новый компилятор на Go: в разы быстрее, но typescript-eslint, `astro check`
и часть плагинов редакторов пока его не поддерживают. Шаблон стоит на 6.0 — когда экосистема
догонит, переход: `npm i -D typescript@7` и `npm run check`.

## Частые ошибки

- **`Property 'value' does not exist on type 'Element'`** — `querySelector` возвращает общий
  `Element`. В JS: `/** @type {HTMLInputElement} */ (el.querySelector('input'))`;
  в TS: `el.querySelector<HTMLInputElement>('input')`.
- **`Type 'Timeout' is not assignable to type 'number'`** — подключены типы Node, и `setTimeout`
  вернул тип Node. В браузерном коде пишите `window.setTimeout`.
- **`Object is possibly 'null'`** — элемента может не быть. Проверьте (`if (!el) return`)
  или используйте `?.`.
