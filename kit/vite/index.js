/**
 * Vite-плагины кита одним вызовом.
 *
 *   // vite.config.js
 *   import { kit } from './kit/vite/index.js'
 *   export default defineConfig({ plugins: [...kit({ pages: true })] })
 *
 * | плагин          | что делает                                   | где работает |
 * |-----------------|----------------------------------------------|--------------|
 * | html-include    | <include src="header.html"> в HTML           | dev + build  |
 * | pages           | все .html в корне — страницы сборки          | build        |
 * | mock-api        | фейковый /api/* из папки mocks/              | только dev   |
 * | devtools-guard  | сборка падает, если dev-инструменты в бандле | только build |
 * @module kit/vite
 */
import { devtoolsGuard } from './devtools-guard.js'
import { htmlInclude } from './html-include.js'
import { mockApi } from './mock-api.js'
import { pagesInput } from './pages.js'

export { devtoolsGuard, htmlInclude, mockApi, pagesInput }

/**
 * @param {object} [o]
 * @param {boolean} [o.include=true] html-include (для многостраничной вёрстки; React не нужен).
 * @param {boolean} [o.pages=true] Собрать все .html корня (для React-SPA — false).
 * @param {false | object} [o.mocks] Настройки mock-api или false.
 */
export function kit({ include = true, pages = true, mocks = {} } = {}) {
  return [include && htmlInclude(), pages && pagesInput(), mocks !== false && mockApi(mocks), devtoolsGuard()].filter(
    Boolean,
  )
}
