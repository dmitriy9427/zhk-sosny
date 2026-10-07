/**
 * Vite-плагин: HTML-компоненты — переиспользуемая вёрстка без фреймворка.
 *
 * Компонент — папка: разметка + стили + (по желанию) JS.
 *
 *   src/components/card/
 *     card.html     разметка (обязательно)
 *     card.scss     стили (подключаются сами, см. src/main.js)
 *     card.js       поведение (по желанию) — запускается само, data-module не нужен
 *
 * Использование на странице или в другом компоненте:
 *
 *   <x-card title="Быстро" :price="1990" class="mt-4">
 *     <p>Это попадёт в <slot /> компонента</p>
 *     <template slot="footer"><a href="/buy">Купить</a></template>
 *   </x-card>
 *
 * Внутри card.html:
 *
 *   <article class="card">
 *     <h3>{{ title }}</h3>
 *     <p x-if="price">{{ price.toLocaleString('ru') }} ₽</p>
 *     <slot />
 *     <footer x-if="$slots.footer"><slot name="footer" /></footer>
 *   </article>
 *
 * ─── Синтаксис (весь) ───────────────────────────────────────────────────────
 * {{ выражение }}         вывести значение (с экранированием < > & ")
 * {{{ выражение }}}       вывести как HTML (без экранирования)
 * attr="текст"            prop-строка; attr без значения → true
 * :attr="выражение"       prop/атрибут из JS-выражения: :price="1990", :items="faq"
 * x-for="item of items"   повторить элемент; (item, i) of items; n of 3 → 1, 2, 3
 * x-if="выражение"        вывести, если истинно; следующий элемент с x-else — иначе
 * <template x-for|x-if>   то же, но без обёртки — выводится только содержимое
 * <slot /> <slot name>    куда вставить содержимое из вызова (внутри — запасное)
 * x-pre                   не обрабатывать содержимое (примеры кода в вёрстке)
 * <include src="a.html">  старый способ: кусок из partials/ (переменные — атрибуты)
 *
 * Данные: каждый файл src/data/*.json|js — переменная с именем файла
 * (faq.json → faq, site-info.json → siteInfo). Всегда есть: page, base, dev, year.
 *
 * Атрибуты class, style, id, role, tabindex, hidden, data-*, aria-* из вызова
 * переходят на корневой элемент компонента (class — дописываются).
 * Если у компонента есть card.js — корню добавляется data-module="card".
 *
 * Работает при сборке и в dev — в браузер не попадает ни строчки, только HTML.
 * @module kit/vite/html-components
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseDocument } from 'htmlparser2'
import renderDom from 'dom-serializer'
import { Element, Text, isTag, isText } from 'domhandler'

const PARSE = {
  lowerCaseAttributeNames: false,
  lowerCaseTags: false,
  recognizeSelfClosing: true,
  decodeEntities: false,
}
const SERIALIZE = { decodeEntities: false, encodeEntities: false, emptyAttrs: false }
const MAX_DEPTH = 25

/** Атрибуты вызова, которые переходят на корень компонента. */
const FALLTHROUGH = /^(class|style|id|role|tabindex|hidden|data-.+|aria-.+)$/
/** Встроенные объекты JS, доступные в выражениях. */
const GLOBALS = new Set([
  'Math',
  'JSON',
  'Number',
  'String',
  'Boolean',
  'Array',
  'Object',
  'Date',
  'Intl',
  'RegExp',
  'encodeURIComponent',
  'encodeURI',
  'parseInt',
  'parseFloat',
  'isNaN',
  'undefined',
  'NaN',
  'Infinity',
])

export const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())

/** Экранировать для HTML. Готовые сущности (&amp; &nbsp; &#8212;) не трогаем. */
export const escapeHtml = (value) =>
  String(value)
    .replace(/&(?!(?:[a-z\d]+|#\d+|#x[\da-f]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** class как в Vue: строка, массив или { 'is-active': условие }. */
function classValue(value) {
  if (Array.isArray(value)) return value.map(classValue).filter(Boolean).join(' ')
  if (value && typeof value === 'object')
    return Object.keys(value)
      .filter((k) => value[k])
      .join(' ')
  return value ? String(value) : ''
}

/** style: строка или { color: 'red', '--gap': '8px' }. */
function styleValue(value) {
  if (value && typeof value === 'object')
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== false)
      .map(([k, v]) => `${k.startsWith('--') ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v}`)
      .join('; ')
  return value ? String(value) : ''
}

// ─── Выражения ───────────────────────────────────────────────────────────────

const compiled = new Map()

/**
 * Вычислить JS-выражение в области видимости шаблона. Неизвестное имя —
 * undefined (а не ReferenceError): `x-if="subtitle"` без subtitle просто ложно.
 */
function evaluate(expr, scope, c, missing) {
  let fn = compiled.get(expr)
  if (!fn) {
    try {
      // with + Proxy: имена ищутся в scope. Function-конструктор — нестрогий режим, with разрешён.
      fn = new Function('$scope', `with ($scope) { return (${expr}\n) }`)
    } catch (error) {
      throw templateError(c, `ошибка синтаксиса в «${expr.trim()}»: ${error.message}`, error)
    }
    compiled.set(expr, fn)
  }
  const proxy = new Proxy(scope, {
    has: (_, key) => typeof key === 'string' && !GLOBALS.has(key),
    get: (target, key) => {
      if (typeof key !== 'string') return undefined
      if (key in target) return target[key]
      missing?.push(key)
      return undefined
    },
  })
  try {
    return fn(proxy)
  } catch (error) {
    throw templateError(c, `не удалось вычислить «${expr.trim()}»: ${error.message}`, error)
  }
}

/** Значение переменной по имени: title, og-image (дефис — как в старых partials). */
function lookup(scope, name) {
  if (name in scope) return scope[name]
  const key = camel(name)
  return key in scope ? scope[key] : undefined
}

const LEGACY_DEFAULT = /^([A-Za-z_$][\w$-]*)\s*\|(?!\|)\s*([\s\S]*)$/
const KEBAB_NAME = /^[A-Za-z_$][\w$]*(?:-[\w$]+)+$/
const MUSTACHE = /\{\{\{([\s\S]+?)\}\}\}|\{\{([\s\S]+?)\}\}/g

/** Подставить {{ }} и {{{ }}} в текст. */
function interpolate(text, scope, c) {
  if (!text.includes('{{')) return text
  return text.replace(MUSTACHE, (_, raw, escaped) => {
    const expr = (raw ?? escaped).trim()
    let value
    // {{ title | Значение по умолчанию }} — синтаксис старых partials.
    const legacy = expr.match(LEGACY_DEFAULT)
    if (legacy) {
      value = lookup(scope, legacy[1])
      if (value === undefined || value === '') value = legacy[2].trim()
    } else if (KEBAB_NAME.test(expr)) {
      value = lookup(scope, expr)
    } else {
      value = evaluate(expr, scope, c)
    }
    if (value === undefined && /^[\w$-]+$/.test(expr) && c.stack.length) {
      c.warn(`${where(c)}: нет значения для {{ ${expr} }} (страница ${c.page})`)
    }
    if (value === undefined || value === null || value === false) return ''
    return raw !== undefined ? String(value) : escapeHtml(value)
  })
}

// ─── Обход дерева ────────────────────────────────────────────────────────────

const where = (c) => (c.stack.length ? c.stack.join(' → ') : c.page)

function templateError(c, message, cause) {
  const error = new Error(`[html] ${c.page}${c.stack.length ? ' → ' + c.stack.join(' → ') : ''}: ${message}`)
  error.name = 'TemplateError'
  if (cause) error.cause = cause
  return error
}

const DIRECTIVES = ['x-for', 'x-if', 'x-else']

function withoutAttrs(node, names) {
  const attribs = { ...node.attribs }
  for (const name of names) delete attribs[name]
  const copy = new Element(node.name, attribs, node.children)
  copy.type = node.type
  return copy
}

/** «item of items», «(item, i) of items», «[key, value] of obj», «n of 3». */
function parseFor(source, c) {
  const match = source.match(/^\s*(\([\s\S]*?\)|\[[\s\S]*?\]|\{[\s\S]*?\}|[\w$]+)\s+(?:of|in)\s+([\s\S]+)$/)
  if (!match) throw templateError(c, `x-for="${source}": ожидается «item of items» или «(item, i) of items»`)
  let head = match[1].trim()
  let index
  if (head.startsWith('(')) {
    head = head.slice(1, -1)
    // (item, i) или ([k, v], i): индекс — после последней запятой верхнего уровня.
    let depth = 0
    let split = -1
    for (let i = 0; i < head.length; i++) {
      if ('[{'.includes(head[i])) depth++
      else if (']}'.includes(head[i])) depth--
      else if (head[i] === ',' && depth === 0) split = i
    }
    if (split >= 0) {
      index = head.slice(split + 1).trim()
      head = head.slice(0, split).trim()
    }
  }
  return { item: head, index, list: match[2], assign: destructure(head) }
}

/** Присвоить значение элементу цикла: item = v или [k, v] = v (деструктуризация). */
function destructure(pattern) {
  if (/^[\w$]+$/.test(pattern)) return (scope, value) => (scope[pattern] = value)
  // Имена из шаблона: [a, b], { title, link: url } → a, b, title, url.
  const names = Array.from(pattern.matchAll(/([A-Za-z_$][\w$]*)\s*(?=[,\]}]|=|$)/g), (m) => m[1])
  const fn = new Function('$value', `const ${pattern} = $value; return { ${names.join(', ')} }`)
  return (scope, value) => Object.assign(scope, fn(value))
}

function toList(value) {
  if (typeof value === 'number') return Array.from({ length: Math.max(0, value) }, (_, i) => i + 1)
  if (value == null) return []
  if (typeof value[Symbol.iterator] === 'function') return Array.from(value)
  if (typeof value === 'object') return Object.entries(value)
  return []
}

function renderNodes(nodes, scope, c) {
  const out = []
  // Результат последнего x-if среди соседей — для x-else. null — x-if не было.
  let lastIf = null
  for (const node of nodes) {
    if (isText(node)) {
      out.push(new Text(c.raw ? node.data : interpolate(node.data, scope, c)))
      if (node.data.trim()) lastIf = null
      continue
    }
    if (!isTag(node)) {
      out.push(node.cloneNode(true))
      continue
    }
    if (c.raw) {
      out.push(node.cloneNode(true))
      continue
    }
    const a = node.attribs
    const isTemplate = node.name.toLowerCase() === 'template' && DIRECTIVES.some((d) => d in a)

    if ('x-else' in a) {
      if (lastIf === null) throw templateError(c, `x-else без x-if перед ним (<${node.name}>)`)
      const show = !lastIf
      lastIf = null
      if (show) out.push(...renderElement(withoutAttrs(node, ['x-else']), scope, c, isTemplate))
      continue
    }

    if ('x-for' in a) {
      lastIf = null
      const { index, list, assign } = parseFor(a['x-for'], c)
      const items = toList(evaluate(list, scope, c))
      const clone = withoutAttrs(node, ['x-for'])
      items.forEach((value, i) => {
        const itemScope = Object.create(scope)
        assign(itemScope, value)
        if (index) itemScope[index] = i
        // x-if на том же элементе проверяется для каждого item (фильтр).
        if ('x-if' in clone.attribs && !evaluate(clone.attribs['x-if'], itemScope, c)) return
        out.push(...renderElement(withoutAttrs(clone, ['x-if']), itemScope, c, isTemplate))
      })
      continue
    }

    if ('x-if' in a) {
      lastIf = Boolean(evaluate(a['x-if'], scope, c))
      if (lastIf) out.push(...renderElement(withoutAttrs(node, ['x-if']), scope, c, isTemplate))
      continue
    }

    lastIf = null
    out.push(...renderElement(node, scope, c, false))
  }
  return out
}

/**
 * Атрибуты обычного элемента: :attr вычисляется, в остальных — {{ }}.
 * @returns {Record<string, string>}
 */
function renderAttrs(attribs, scope, c) {
  /** @type {Record<string, string>} */
  const result = {}
  const bound = {}
  for (const [name, value] of Object.entries(attribs)) {
    if (name.startsWith(':')) bound[name.slice(1)] = evaluate(value, scope, c)
    else result[name] = interpolate(value, scope, c)
  }
  for (const [name, value] of Object.entries(bound)) {
    if (name === 'class') {
      const merged = [result.class, classValue(value)].filter(Boolean).join(' ')
      if (merged) result.class = merged
      continue
    }
    if (name === 'style') {
      const merged = [result.style, styleValue(value)].filter(Boolean).join('; ')
      if (merged) result.style = merged
      continue
    }
    if (value === false || value === null || value === undefined) continue
    result[name] = value === true ? '' : escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)
  }
  return result
}

function renderElement(node, scope, c, unwrap) {
  const tag = node.name.toLowerCase()
  if (unwrap) return renderNodes(node.children, scope, c)

  if ('x-pre' in node.attribs) {
    const copy = withoutAttrs(node, ['x-pre'])
    copy.children = renderNodes(node.children, scope, { ...c, raw: true })
    return [copy]
  }
  if (tag === 'include') return renderInclude(node, scope, c)
  if (tag === 'slot' && c.slots) return renderSlot(node, scope, c)
  if (tag.startsWith('x-')) return renderComponent(node, scope, c)

  const copy = new Element(node.name, renderAttrs(node.attribs, scope, c), [])
  copy.type = node.type
  // <script> и <style> — содержимое как есть (там свои фигурные скобки).
  copy.children = node.type === 'tag' ? renderNodes(node.children, scope, c) : node.children.map((n) => n.cloneNode())
  copy.children.forEach((child) => (child.parent = copy))
  return [copy]
}

function renderSlot(node, scope, c) {
  const name = node.attribs.name || 'default'
  const provided = c.slots.nodes[name]
  if (provided && hasContent(provided)) return renderNodes(provided, c.slots.scope, c.slots.ctx)
  return renderNodes(node.children, scope, c) // запасное содержимое
}

const hasContent = (nodes) => nodes.some((n) => !isText(n) || n.data.trim())

function renderComponent(node, scope, c) {
  const name = node.name.toLowerCase().slice(2)
  if (c.stack.length >= MAX_DEPTH)
    throw templateError(c, `слишком глубокая вложенность компонентов (бесконечная рекурсия?)`)
  const component = c.load(name)
  if (!component) {
    const known = c.list()
    throw templateError(
      c,
      `нет компонента <x-${name}>. Ожидается файл ${c.componentsLabel}/${name}/${name}.html` +
        (known.length ? `. Есть: ${known.map((n) => `x-${n}`).join(', ')}` : ''),
    )
  }

  // props: attr="текст" (без значения → true), :attr="выражение".
  const props = {}
  const passed = {}
  for (const [attr, value] of Object.entries(node.attribs)) {
    const isBound = attr.startsWith(':')
    const key = isBound ? attr.slice(1) : attr
    const val = isBound ? evaluate(value, scope, c) : value === '' ? true : interpolate(value, scope, c)
    props[camel(key)] = val
    passed[key] = val
  }

  // Слоты: <template slot="имя"> или элемент со slot="имя"; остальное — в default.
  const slots = { default: [] }
  for (const child of node.children) {
    const slot = isTag(child) ? child.attribs.slot : undefined
    if (!slot) slots.default.push(child)
    else if (child.name.toLowerCase() === 'template') slots[slot] = child.children
    else slots[slot] = [withoutAttrs(child, ['slot'])]
  }
  const $slots = Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, hasContent(v)]))

  const local = Object.assign(Object.create(c.globals), props, { $props: props, $attrs: passed, $slots })
  const inner = {
    ...c,
    stack: [...c.stack, `x-${name}`],
    slots: { nodes: slots, scope, ctx: c },
  }
  const nodes = renderNodes(component.nodes, local, inner)

  // Атрибуты вызова → корень компонента.
  const rootEl = nodes.find((n) => isTag(n))
  const fall = Object.entries(passed).filter(([k]) => FALLTHROUGH.test(k))
  if (rootEl) {
    for (const [key, val] of fall) {
      if (key === 'class') rootEl.attribs.class = [rootEl.attribs.class, classValue(val)].filter(Boolean).join(' ')
      else if (key === 'style')
        rootEl.attribs.style = [rootEl.attribs.style, styleValue(val)].filter(Boolean).join('; ')
      else if (key === 'data-module') addModule(rootEl, String(val))
      else if (val !== false && val !== null && val !== undefined)
        rootEl.attribs[key] = val === true ? '' : escapeHtml(String(val))
    }
    if (component.script) addModule(rootEl, name)
  } else if (component.script || fall.length) {
    c.warn(`${where(inner)}: у компонента нет корневого элемента — некуда поставить data-module/class`)
  }
  return nodes
}

function addModule(el, name) {
  const names = (el.attribs['data-module'] ?? '').split(/\s+/).filter(Boolean)
  for (const n of name.split(/\s+/)) if (n && !names.includes(n)) names.push(n)
  el.attribs['data-module'] = names.join(' ')
}

function renderInclude(node, scope, c) {
  const { src, ...attrs } = node.attribs
  if (!src) throw templateError(c, 'у <include> нет атрибута src')
  if (!c.partials) throw templateError(c, `<include src="${src}">: папка partials не настроена`)
  if (c.stack.includes(src)) throw templateError(c, `цикл: ${[...c.stack, src].join(' → ')}`)
  const file = resolve(c.partials, src)
  if (!file.startsWith(resolve(c.partials) + sep)) throw templateError(c, `${src}: путь выходит за папку partials`)
  if (!existsSync(file)) throw templateError(c, `нет файла ${relative(process.cwd(), file)}`)
  // Кусок видит переменные родителя; свои атрибуты важнее.
  const local = Object.create(scope)
  for (const [k, v] of Object.entries(attrs)) {
    const key = k.startsWith(':') ? k.slice(1) : k
    const val = k.startsWith(':') ? evaluate(v, scope, c) : interpolate(v, scope, c)
    local[key] = val
    local[camel(key)] = val
  }
  const nodes = parseDocument(readFileSync(file, 'utf8'), PARSE).children
  return renderNodes(nodes, local, { ...c, stack: [...c.stack, src] })
}

// ─── Компоненты на диске ─────────────────────────────────────────────────────

/**
 * Комментарии ВЕРХНЕГО уровня файла компонента — его документация, в каждую
 * вставку на странице их не копируем. Комментарии внутри разметки остаются.
 * Пустые строки по краям тоже убираем — иначе вокруг вставки лишние отступы.
 */
function stripDocs(nodes) {
  const list = nodes.filter((n) => n.type !== 'comment')
  while (list.length && isText(list[0]) && !list[0].data.trim()) list.shift()
  while (list.length && isText(list.at(-1)) && !list.at(-1).data.trim()) list.pop()
  return list
}

/**
 * Загрузчик компонентов из папок (первая найденная — главнее: проект перекрывает кит).
 * Разобранная разметка кешируется до изменения файла.
 */
export function componentLoader(dirs) {
  const cache = new Map()
  const load = (name) => {
    for (const dir of dirs) {
      const file = join(dir, name, `${name}.html`)
      if (!existsSync(file)) continue
      const mtime = statSync(file).mtimeMs
      const hit = cache.get(file)
      if (hit && hit.mtime === mtime) return hit
      const entry = {
        file,
        mtime,
        nodes: stripDocs(parseDocument(readFileSync(file, 'utf8'), PARSE).children),
        script: ['js', 'ts'].some((ext) => existsSync(join(dir, name, `${name}.${ext}`))),
      }
      cache.set(file, entry)
      return entry
    }
    return null
  }
  const list = () =>
    [
      ...new Set(
        dirs.flatMap((dir) =>
          existsSync(dir) ? readdirSync(dir).filter((n) => existsSync(join(dir, n, `${n}.html`))) : [],
        ),
      ),
    ].sort()
  return { load, list }
}

/** Данные из папки: faq.json → faq, site-info.js (export default) → siteInfo. */
export async function loadData(dir) {
  const data = {}
  if (!dir || !existsSync(dir)) return data
  for (const file of readdirSync(dir).sort()) {
    const ext = extname(file)
    const key = camel(basename(file, ext))
    const path = join(dir, file)
    if (ext === '.json') {
      try {
        data[key] = JSON.parse(readFileSync(path, 'utf8'))
      } catch (error) {
        throw new Error(`[html] ошибка в ${relative(process.cwd(), path)}: ${error.message}`, { cause: error })
      }
    } else if (ext === '.js' || ext === '.mjs') {
      // ?t= — свежая версия после правки файла в dev (иначе Node отдаст кеш).
      const mod = await import(`${pathToFileURL(path).href}?t=${statSync(path).mtimeMs}`)
      data[key] = mod.default ?? { ...mod }
    }
  }
  return data
}

/**
 * Отрисовать HTML: компоненты, директивы, выражения. Чистая функция — без Vite.
 * @param {string} html
 * @param {{ components?: string[], partials?: string, globals?: object, page?: string, warn?: (m: string) => void, loader?: ReturnType<typeof componentLoader> }} [o]
 */
export function renderHtml(
  html,
  { components = [], partials, globals = {}, page = 'страница', warn = console.warn, loader } = {},
) {
  const { load, list } = loader ?? componentLoader(components)
  const c = {
    page,
    partials,
    warn,
    load,
    list,
    globals,
    stack: [],
    slots: null,
    raw: false,
    componentsLabel: components[0] ? relative(process.cwd(), components[0]) || '.' : 'src/components',
  }
  const doc = parseDocument(html, PARSE)
  doc.children = renderNodes(doc.children, Object.create(globals), c)
  doc.children.forEach((child) => (child.parent = doc))
  return renderDom(doc, SERIALIZE)
}

/**
 * Пометить ссылки на текущую страницу aria-current="page".
 * '/about.html', '/about', 'about.html' — считаются одной страницей.
 */
export function markCurrentLinks(html, pagePath) {
  const norm = (p) =>
    ('/' + p.replace(/^\.?\//, '').replace(/^%BASE_URL%/, ''))
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

/**
 * @param {object} [o]
 * @param {string | string[]} [o.components='src/components'] Папки компонентов (первая главнее).
 * @param {string} [o.partials='partials'] Папка для <include> (старый способ).
 * @param {string} [o.data='src/data'] Папка с данными для шаблонов.
 */
export function htmlComponents({ components = 'src/components', partials = 'partials', data = 'src/data' } = {}) {
  let dirs = []
  let partialsDir = ''
  let dataDir = ''
  let base = '/'
  let dev = false
  let loader
  return {
    name: 'kit:html',
    configResolved(config) {
      dirs = [components].flat().map((d) => resolve(config.root, d))
      partialsDir = resolve(config.root, partials)
      dataDir = resolve(config.root, data)
      base = config.base
      dev = config.command === 'serve'
      loader = componentLoader(dirs)
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        const path = ctx.path || '/'
        const globals = {
          ...(await loadData(dataDir)),
          page: { path, file: ctx.filename },
          base,
          dev,
          year: new Date().getFullYear(),
        }
        const rendered = renderHtml(html, { loader, partials: partialsDir, globals, page: path, components: dirs })
        return markCurrentLinks(rendered, path)
      },
    },
    configureServer(server) {
      const watched = [...dirs, partialsDir, dataDir]
      watched.forEach((d) => server.watcher.add(d))
      // Разметка и данные — перезагрузить страницу. JS и SCSS компонентов Vite обновит сам.
      const reload = (file) => {
        if (watched.some((d) => file.startsWith(d + sep)) && /\.(html|json|m?js)$/.test(file)) {
          if (file.startsWith(dataDir + sep) || file.endsWith('.html')) server.ws.send({ type: 'full-reload' })
        }
      }
      server.watcher.on('change', reload)
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)
    },
  }
}
