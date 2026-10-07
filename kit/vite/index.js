/**
 * Vite-плагины кита одним вызовом.
 *
 *   // vite.config.js
 *   import { kit } from './kit/vite/index.js'
 *   export default defineConfig({ plugins: [...kit()] })
 *
 * | плагин          | что делает                                               | где работает |
 * |-----------------|----------------------------------------------------------|--------------|
 * | html            | <x-компоненты>, {{ выражения }}, x-for/x-if, <include>   | dev + build  |
 * | svg-sprite      | иконки из src/icons → спрайт в странице (#icon-имя)      | dev + build  |
 * | pages           | все .html в корне — страницы сборки                      | build        |
 * | mock-api        | фейковый /api/* из папки mocks/                          | только dev   |
 * | devtools-guard  | сборка падает, если dev-инструменты в бандле             | только build |
 * @module kit/vite
 */
import { devtoolsGuard } from './devtools-guard.js'
import { htmlComponents } from './html-components.js'
import { htmlInclude } from './html-include.js'
import { mockApi } from './mock-api.js'
import { pagesInput } from './pages.js'
import { svgSprite } from './svg-sprite.js'

export { devtoolsGuard, htmlComponents, htmlInclude, mockApi, pagesInput, svgSprite }

/**
 * @param {object} [o]
 * @param {boolean | object} [o.include=true] HTML-компоненты и include (для многостраничной
 *   вёрстки; React не нужен). Объект — настройки: { components, partials, data }.
 * @param {false | object} [o.icons] Настройки svg-sprite или false.
 * @param {boolean} [o.pages=true] Собрать все .html корня (для React-SPA — false).
 * @param {false | object} [o.mocks] Настройки mock-api или false.
 */
export function kit({ include = true, icons = {}, pages = true, mocks = {} } = {}) {
  return [
    include && htmlComponents(include === true ? {} : include),
    icons !== false && svgSprite(icons),
    pages && pagesInput(),
    mocks !== false && mockApi(mocks),
    devtoolsGuard(),
  ].filter(Boolean)
}
