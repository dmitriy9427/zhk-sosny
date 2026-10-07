/**
 * Доступ к другим модулям из JS + регистрация модулей по папкам.
 *
 * ─── Доступ: modules (он же ctx.modules и app.modules) ──────────────────────
 *   import { modules } from 'kit/js/core/modules.js'
 *
 *   modules.get('#faq')                   экземпляр модуля на элементе (если модуль один)
 *   modules.get('#callback', 'dialog')    конкретный модуль на элементе
 *   modules.get(el, 'tabs')               то же по элементу
 *   modules.all('accordion')              все запущенные аккордеоны страницы
 *   modules.first('cart')                 первый запущенный модуль «cart»
 *   await modules.when('#cart', 'cart')   ДОЖДАТЬСЯ запуска (ленивые грузятся не сразу)
 *   await modules.whenAny('cart')         дождаться первого «cart» где угодно
 *
 * «Экземпляр» — то, что вернула функция модуля: { open, close, destroy … }.
 * Хотите управлять модулем снаружи — верните из него методы (docs/modules.md).
 *
 * Когда что:
 * - знаете, на каком элементе модуль, и он точно запущен (клик пользователя
 *   после загрузки) — get;
 * - код выполняется при старте другого модуля — when: порядок запуска
 *   модулей не гарантирован, ленивые модули грузятся по сети;
 * - модули не должны знать друг о друге вовсе — шина ctx.bus (события).
 *
 * ─── Регистрация по папкам: modulesFromGlob ─────────────────────────────────
 *   const components = modulesFromGlob(import.meta.glob(['./components/*\/*.js', '!**\/*.test.js']))
 *   // { card: lazy(…), 'price-calc': lazy(…) } — имя = имя файла (или папки для index.js)
 *
 * Новый модуль/компонент не нужно дописывать в реестр руками.
 * @module kit/core/modules
 */
import { getInstance, lazy, mountedNames, waitMounted } from './registry.js'

/**
 * @param {Element | string} target
 * @param {ParentNode} [root]
 */
function element(target, root = document) {
  if (typeof target !== 'string') return target
  return root.querySelector(target)
}

const describe = (target) => (typeof target === 'string' ? target : `<${target?.tagName?.toLowerCase()}>`)

/**
 * @param {{ root?: ParentNode }} [o]
 */
export function createModulesApi({ root = document } = {}) {
  /**
   * Экземпляр модуля на элементе.
   * @param {Element | string} target Элемент или CSS-селектор.
   * @param {string} [name] Имя модуля; можно не указывать, если на элементе он один.
   */
  function get(target, name) {
    const el = element(target, root)
    if (!el) return undefined
    if (name) return getInstance(el, name)
    const names = mountedNames(el)
    if (names.length > 1)
      throw new Error(
        `[kit] на ${describe(target)} несколько модулей (${names.join(', ')}) — укажите имя: get(el, 'имя')`,
      )
    return names.length ? getInstance(el, names[0]) : undefined
  }

  /**
   * Все запущенные экземпляры модуля name.
   * @param {string} name
   * @param {ParentNode} [scope] Где искать (по умолчанию вся страница).
   */
  function all(name, scope = root) {
    return Array.from(scope.querySelectorAll(`[data-module~="${name}"]`))
      .filter((el) => mountedNames(el).includes(name))
      .map((el) => getInstance(el, name))
  }

  /** Первый запущенный модуль name (или undefined). */
  const first = (name, scope = root) => all(name, scope)[0]

  /**
   * Дождаться запуска модуля на элементе. Если уже запущен — сразу.
   * @param {Element | string} target Элемент или селектор (элемент может появиться позже).
   * @param {string} [name] Имя модуля; без имени — любой первый модуль элемента.
   * @param {{ timeout?: number, signal?: AbortSignal }} [o] timeout 0 — ждать бесконечно.
   */
  async function when(target, name, o = {}) {
    const el = element(target, root)
    if (el) {
      const names = mountedNames(el)
      const ready = name ? names.includes(name) : names.length > 0
      if (ready) return getInstance(el, name ?? names[0])
    }
    const matches = (candidate) =>
      typeof target === 'string' ? candidate.matches(target) && root.contains(candidate) : candidate === target
    const found = await waitMounted((candidate, n) => matches(candidate) && (!name || n === name), {
      ...o,
      label: `${name ?? 'модуль'} на ${describe(target)}`,
    })
    return getInstance(found.el, found.name)
  }

  /**
   * Дождаться первого запущенного модуля name где угодно на странице.
   * @param {string} name
   * @param {{ timeout?: number, signal?: AbortSignal }} [o]
   */
  async function whenAny(name, o = {}) {
    const ready = first(name)
    if (ready !== undefined) return ready
    const found = await waitMounted((el, n) => n === name && root.contains(el), { ...o, label: `«${name}»` })
    return getInstance(found.el, found.name)
  }

  return { get, all, first, when, whenAny }
}

/** Доступ к модулям всей страницы. Тот же объект приходит модулям как ctx.modules. */
export const modules = createModulesApi()

/**
 * Реестр модулей из import.meta.glob.
 *   ./components/card/card.js     → card
 *   ./modules/price-calc/index.js → price-calc
 * Ленивая загрузка (функция-загрузчик) превращается в lazy(): код скачается,
 * только если блок есть на странице. С { eager: true } — обычный модуль.
 * @param {Record<string, (() => Promise<any>) | Record<string, any>>} files
 */
export function modulesFromGlob(files) {
  /** @type {Record<string, Function>} */
  const registry = {}
  for (const [path, entry] of Object.entries(files)) {
    const parts = path.split('/')
    const file = parts.pop().replace(/\.[cm]?[jt]sx?$/, '')
    if (/\.(test|spec|stories)$/.test(file)) continue
    const name = file === 'index' ? parts.pop() : file
    if (typeof entry === 'function') registry[name] = lazy(/** @type {() => Promise<any>} */ (entry))
    else {
      const init = entry.default ?? entry.init
      if (typeof init !== 'function') {
        console.warn(`[kit] ${path}: нет export default function — модуль «${name}» пропущен`)
        continue
      }
      registry[name] = init
    }
  }
  return registry
}

/**
 * Плагины приложения из import.meta.glob({ eager: true }) — массив функций в
 * порядке имён файлов (порядок задают префиксы: 01-gsap.js, 02-analytics.js).
 *   createApp({ plugins: pluginsFromGlob(import.meta.glob('./plugins/*.js', { eager: true })) })
 * @param {Record<string, any>} files
 * @returns {Function[]}
 */
export function pluginsFromGlob(files) {
  return Object.keys(files)
    .filter((path) => !/\.(test|spec)\.[cm]?[jt]sx?$/.test(path))
    .sort()
    .flatMap((path) => {
      const fn = files[path]?.default
      if (typeof fn === 'function') return [fn]
      console.warn(`[kit] ${path}: плагин должен экспортировать default function ({ ctx, modules }) {…}`)
      return []
    })
}
