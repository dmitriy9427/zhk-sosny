/**
 * Vite-плагин: вставка кусков HTML (шапка, подвал) в страницы.
 *
 *   <!-- index.html -->
 *   <include src="header.html" title="Главная"></include>
 *
 *   <!-- partials/header.html -->
 *   <header>… <h1>{{ title }}</h1> …</header>
 *
 * ─── Возможности ─────────────────────────────────────────────────────────────
 * - Атрибуты тега include становятся переменными {{ имя }} внутри куска.
 *   {{ имя | значение по умолчанию }} — если атрибут не передали.
 * - Вложенные include (кусок может включать другой кусок).
 * - Ссылки на текущую страницу автоматически получают aria-current="page" —
 *   активный пункт меню без ручной разметки на каждой странице. Стилизуйте
 *   через [aria-current='page'].
 * - Правка куска в dev — страница перезагружается сама.
 *
 * ─── Понятные ошибки вместо пустоты ──────────────────────────────────────────
 * - нет файла → ошибка с именем страницы и путём;
 * - бесконечная вложенность (a включает b, b включает a) → ошибка с цепочкой;
 * - переменная без значения и без умолчания → предупреждение в консоли
 *   сборки (а не молчаливое «undefined» в вёрстке).
 *
 * Работает только на этапе сборки/dev — в браузер не попадает ни строчки.
 * @module kit/vite/html-include
 */
import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const INCLUDE = /<include\s+([^>]*?)\s*(?:\/>|>\s*<\/include>)/g
const ATTR = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
const VAR = /\{\{\s*([\w-]+)\s*(?:\|\s*([^}]*?))?\s*\}\}/g
const MAX_DEPTH = 10

const COMMENT = /(<!--[\s\S]*?-->)/

/** Применить fn только к тексту вне HTML-комментариев (примеры в комментариях не разворачиваются). */
const outsideComments = (html, fn) =>
  html
    .split(COMMENT)
    .map((part) => (part.startsWith('<!--') ? part : fn(part)))
    .join('')

const parseAttrs = (source) => Object.fromEntries(Array.from(source.matchAll(ATTR), (m) => [m[1], m[2] ?? m[3]]))

/**
 * Развернуть include в HTML. Чистая функция (без Vite) — удобно тестировать.
 * @param {string} html
 * @param {{ dir: string, page?: string, warn?: (msg: string) => void }} o
 */
export function renderIncludes(html, { dir, page = 'страница', warn = console.warn }, vars = {}, chain = []) {
  if (chain.length > MAX_DEPTH) {
    throw new Error(`[html-include] слишком глубокая вложенность (цикл?): ${chain.join(' → ')}`)
  }
  return outsideComments(html, (text) => expand(text, { dir, page, warn }, vars, chain))
}

function expand(html, { dir, page, warn }, vars, chain) {
  const withVars = html.replace(VAR, (_, name, fallback) => {
    if (name in vars) return vars[name]
    if (fallback !== undefined) return fallback.trim()
    if (chain.length) warn(`[html-include] ${chain.at(-1)}: нет значения для {{ ${name} }} (страница ${page})`)
    return ''
  })
  return withVars.replace(INCLUDE, (_, attrSource) => {
    const { src, ...attrs } = parseAttrs(attrSource)
    if (!src) throw new Error(`[html-include] ${page}: у <include> нет атрибута src`)
    if (chain.includes(src)) throw new Error(`[html-include] цикл: ${[...chain, src].join(' → ')}`)
    const file = resolve(dir, src)
    if (!file.startsWith(resolve(dir) + sep)) throw new Error(`[html-include] ${src}: путь выходит за папку partials`)
    if (!existsSync(file)) throw new Error(`[html-include] ${page}: нет файла ${relative(process.cwd(), file)}`)
    // Переменные родителя доступны вложенному куску; свои атрибуты — важнее.
    return renderIncludes(readFileSync(file, 'utf8'), { dir, page, warn }, { ...vars, ...attrs }, [...chain, src])
  })
}

/**
 * Пометить ссылки на текущую страницу aria-current="page".
 * '/about.html', '/about', 'about.html' — считаются одной страницей.
 */
export function markCurrentLinks(html, pagePath) {
  const norm = (p) =>
    ('/' + p.replace(/^\.?\//, ''))
      .replace(/[?#].*$/, '')
      .replace(/index\.html$/, '')
      .replace(/\.html$/, '')
      .replace(/\/$/, '') || '/'
  const current = norm(pagePath)
  return html.replace(/<a\b([^>]*?)\bhref="([^"]+)"([^>]*)>/g, (tag, before, href, after) => {
    // Якоря (/#faq) — это разделы страницы, а не сама страница: не помечаем.
    if (/^(https?:|mailto:|tel:)/.test(href) || href.includes('#') || /aria-current/.test(tag)) return tag
    return norm(href) === current ? `<a${before}href="${href}" aria-current="page"${after}>` : tag
  })
}

/** @param {{ dir?: string }} [o] dir — папка с кусками относительно корня проекта. */
export function htmlInclude({ dir = 'partials' } = {}) {
  let partials = ''
  return {
    name: 'kit:html-include',
    configResolved(config) {
      partials = resolve(config.root, dir)
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = ctx.path || ctx.filename
        const rendered = renderIncludes(html, { dir: partials, page })
        return markCurrentLinks(rendered, ctx.path || '/')
      },
    },
    configureServer(server) {
      server.watcher.add(partials)
      server.watcher.on('change', (file) => {
        if (file.startsWith(partials)) server.ws.send({ type: 'full-reload' })
      })
    },
  }
}
