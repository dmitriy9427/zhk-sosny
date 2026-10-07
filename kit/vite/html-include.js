/**
 * Старое имя плагина HTML-шаблонов — оставлено для совместимости с проектами,
 * созданными до появления компонентов. Вся работа — в html-components.js:
 * там и <include src="…">, и <x-компоненты>, и {{ выражения }}.
 *
 *   <include src="header.html" title="Главная"></include>   ← partials/header.html
 *   внутри куска: {{ title | Значение по умолчанию }}
 *
 * Новое лучше делать компонентами (docs/components.md): у них свои стили и JS,
 * props, слоты, циклы.
 * @module kit/vite/html-include
 */
import { htmlComponents, markCurrentLinks, renderHtml } from './html-components.js'

export { markCurrentLinks }

/**
 * Развернуть <include> в HTML (без компонентов и данных). Для тестов и скриптов.
 * @param {string} html
 * @param {{ dir: string, page?: string, warn?: (msg: string) => void }} o
 */
export const renderIncludes = (html, { dir, page = 'страница', warn = console.warn }) =>
  renderHtml(html, { partials: dir, page, warn })

/** @param {{ dir?: string }} [o] dir — папка с кусками относительно корня проекта. */
export const htmlInclude = ({ dir = 'partials' } = {}) => htmlComponents({ partials: dir })
