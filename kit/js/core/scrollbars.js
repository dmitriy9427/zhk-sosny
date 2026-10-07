/**
 * «Плавающий» скроллбар (OverlayScrollbars) для блоков ВНУТРИ модулей кита:
 * выпадающий список селекта, окно модалки. Чтобы они выглядели одинаково в
 * Windows, macOS и Linux, а не системной серой полосой.
 *
 *   const detach = attachScrollbar(dropdown)   // в модуле
 *   d.add(detach)                              // уборка в destroy
 *
 * ─── Когда НЕ подключается ─────────────────────────────────────────────────
 * - тач-экран (нет мыши, pointer: coarse): системный скроллбар там и так
 *   тонкий и плавающий, а лишний JS телефону ни к чему;
 * - выключено для проекта: setKitScrollbars(false) (например, в src/plugins);
 * - выключено у блока: data-scrollbar="native" на нём или на предке.
 * Тогда остаётся CSS-скроллбар в цветах темы (kit/scss/base/_scrollbar.scss).
 *
 * Код библиотеки (~15 КБ) грузится лениво — при первом блоке, которому он нужен.
 * Для своих блоков используйте модуль data-module="scrollbar".
 * @module kit/core/scrollbars
 */

let enabled = true
/** @type {Promise<any> | null} */
let library = null

/** Включить/выключить красивые скроллбары в модулях кита для всего проекта. */
export function setKitScrollbars(value) {
  enabled = Boolean(value)
}

/**
 * Настройки OverlayScrollbars в стиле кита (общие с модулем scrollbar).
 * @param {{ axis?: 'x' | 'y' | 'both', autoHide?: string, autoHideDelay?: number, theme?: string }} [o]
 * @returns {import('overlayscrollbars').PartialOptions}
 */
export function scrollbarOptions({ axis = 'y', autoHide = 'leave', autoHideDelay = 600, theme = 'os-theme-kit' } = {}) {
  return {
    overflow: {
      x: axis === 'y' ? /** @type {const} */ ('hidden') : /** @type {const} */ ('scroll'),
      y: axis === 'x' ? /** @type {const} */ ('hidden') : /** @type {const} */ ('scroll'),
    },
    scrollbars: {
      theme,
      autoHide: /** @type {'never' | 'scroll' | 'leave' | 'move'} */ (autoHide),
      autoHideDelay,
      clickScroll: true,
    },
  }
}

const hasMouse = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches

function load() {
  library ??= Promise.all([import('overlayscrollbars'), import('overlayscrollbars/overlayscrollbars.css')]).then(
    ([mod]) => mod.OverlayScrollbars,
  )
  return library
}

/**
 * Подключить плавающий скроллбар к блоку. Возвращает функцию уборки.
 * @param {HTMLElement} el Блок с overflow: auto.
 * @param {{ axis?: 'x' | 'y' | 'both', force?: boolean }} [o] force — даже без мыши (тесты, особые случаи).
 * @returns {(() => void) & { ready: Promise<any>, update: () => void }}
 */
export function attachScrollbar(el, { axis = 'y', force = false } = {}) {
  let instance = null
  let cancelled = false
  const skip = !force && (!enabled || !hasMouse() || el.closest('[data-scrollbar="native"]'))
  const ready = skip
    ? Promise.resolve(null)
    : load()
        .then((OverlayScrollbars) => {
          if (cancelled || !el.isConnected) return null
          instance = OverlayScrollbars(el, scrollbarOptions({ axis }))
          return instance
        })
        .catch((error) => {
          console.warn('[kit] не удалось подключить скроллбар — остаётся системный', error)
          return null
        })
  const detach = () => {
    cancelled = true
    instance?.destroy()
    instance = null
  }
  // Блок был скрыт (display: none) и показался — пересчитать размеры. Без этого
  // библиотека считает, что прокручивать нечего, и прячет прокрутку совсем.
  const update = () => instance?.update(true)
  return Object.assign(detach, { ready, update })
}
