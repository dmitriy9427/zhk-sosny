/**
 * Vite-плагин: SVG-спрайт из папки иконок.
 *
 *   src/icons/heart.svg, src/icons/cart.svg …
 *
 *   <svg class="icon"><use href="#icon-heart"></use></svg>
 *   или компонентом: <x-icon name="heart" />
 *
 * ─── Что делает ─────────────────────────────────────────────────────────────
 * - Каждый файл → <symbol id="icon-имя"> внутри скрытого <svg> сразу после
 *   <body>. Спрайт встроен в страницу: нет отдельного запроса, не ломается
 *   в подпапке и на file://, иконки перекрашиваются через CSS (color).
 * - В страницу попадают ТОЛЬКО иконки, которые на ней используются
 *   (#icon-… в разметке). Для иконок, которые создаёт JS, — опция `always`.
 * - Цвета из файла (#000, black, #1e1e1e…) заменяются на currentColor:
 *   иконка берёт цвет текста. Многоцветная иконка (логотип, флаг) —
 *   назовите файл `имя.color.svg`, её цвета не трогаются (id: icon-имя).
 * - Лишнее из экспорта Figma/Illustrator убирается: width/height, xmlns,
 *   class, <title>, комментарии.
 * - Опечатка в имени иконки → предупреждение со списком доступных.
 *
 * Размер иконки — CSS-класс .icon из кита (1em × 1em, см. kit/scss/components/_icon.scss).
 * @module kit/vite/svg-sprite
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'

const KEEP_ROOT_ATTRS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'fill-rule',
  'clip-rule',
]
const COLOR_ATTR = /\s(fill|stroke)="(?!none|currentColor|url\()([^"]+)"/gi

/**
 * Превратить содержимое SVG-файла в <symbol>.
 * @param {string} source
 * @param {string} id
 * @param {{ keepColors?: boolean }} [o]
 */
export function toSymbol(source, id, { keepColors = false } = {}) {
  const svg = source
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
  const open = svg.match(/<svg\b([^>]*)>/i)
  if (!open) throw new Error(`[svg-sprite] ${id}: в файле нет <svg>`)
  const attrs = open[1]
  const viewBox = attrs.match(/viewBox="([^"]+)"/i)?.[1] ?? sizeViewBox(attrs)
  if (!viewBox) throw new Error(`[svg-sprite] ${id}: нет viewBox (и width/height) — иконка не будет масштабироваться`)
  const kept = KEEP_ROOT_ATTRS.map((name) => {
    const value = attrs.match(new RegExp(`\\s${name}="([^"]+)"`, 'i'))?.[1]
    return value ? ` ${name}="${value}"` : ''
  }).join('')
  let inner = svg.slice(open.index + open[0].length, svg.lastIndexOf('</svg>')).trim()
  let rootAttrs = kept
  if (!keepColors) {
    inner = inner.replace(COLOR_ATTR, ' $1="currentColor"')
    rootAttrs = rootAttrs.replace(COLOR_ATTR, ' $1="currentColor"')
  }
  return `<symbol id="${id}" viewBox="${viewBox}"${rootAttrs}>${inner}</symbol>`
}

function sizeViewBox(attrs) {
  const w = parseFloat(attrs.match(/\swidth="([\d.]+)/)?.[1] ?? '')
  const h = parseFloat(attrs.match(/\sheight="([\d.]+)/)?.[1] ?? '')
  return w && h ? `0 0 ${w} ${h}` : null
}

/** Прочитать иконки папки: имя → { file, keepColors }. */
export function readIcons(dir) {
  const icons = new Map()
  if (!existsSync(dir)) return icons
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
    const keepColors = file.endsWith('.color.svg')
    const name = basename(file, keepColors ? '.color.svg' : '.svg')
    icons.set(name, { file: join(dir, file), keepColors })
  }
  return icons
}

/** Имена иконок, на которые ссылается разметка: href="#icon-x", xlink:href="#icon-x". */
export const usedIcons = (html, prefix = 'icon-') =>
  new Set(Array.from(html.matchAll(new RegExp(`href="#${prefix}([\\w-]+)"`, 'g')), (m) => m[1]))

/**
 * @param {object} [o]
 * @param {string} [o.dir='src/icons'] Папка с .svg.
 * @param {string} [o.prefix='icon-'] Префикс id: #icon-heart.
 * @param {string[] | 'all'} [o.always=[]] Иконки, которые нужны всегда (их вставляет JS), или 'all'.
 */
export function svgSprite({ dir = 'src/icons', prefix = 'icon-', always = [] } = {}) {
  let iconsDir = ''
  const cache = new Map()
  const symbol = (name, { file, keepColors }) => {
    const mtime = statSync(file).mtimeMs
    const hit = cache.get(file)
    if (hit?.mtime === mtime) return hit.value
    const value = toSymbol(readFileSync(file, 'utf8'), prefix + name, { keepColors })
    cache.set(file, { mtime, value })
    return value
  }
  return {
    name: 'kit:svg-sprite',
    configResolved(config) {
      iconsDir = resolve(config.root, dir)
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const icons = readIcons(iconsDir)
        const wanted = always === 'all' ? new Set(icons.keys()) : new Set([...usedIcons(html, prefix), ...always])
        if (!wanted.size) return html
        const symbols = []
        for (const name of wanted) {
          const icon = icons.get(name)
          if (!icon) {
            const known = [...icons.keys()].join(', ') || '— (папка пуста)'
            console.warn(`[svg-sprite] ${ctx.path}: нет иконки «${name}» (${dir}/${name}.svg). Есть: ${known}`)
            continue
          }
          symbols.push(symbol(name, icon))
        }
        const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${symbols.join('')}</svg>`
        return html.replace(/<body\b[^>]*>/i, (tag) => `${tag}\n${sprite}`)
      },
    },
    configureServer(server) {
      server.watcher.add(iconsDir)
      server.watcher.on('all', (_, file) => {
        if (file.startsWith(iconsDir + sep) && file.endsWith('.svg')) server.ws.send({ type: 'full-reload' })
      })
    },
  }
}
