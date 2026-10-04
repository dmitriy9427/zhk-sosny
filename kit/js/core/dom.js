/**
 * Мелкие помощники для работы с DOM.
 * @module kit/core/dom
 */

export const qs = (selector, root = document) => root.querySelector(selector)
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector))

let counter = 0
/** Уникальный id для связки aria-controls / aria-labelledby. */
export const uid = (prefix = 'kit') => `${prefix}-${++counter}`

/** Дать элементу id, если его нет, и вернуть id. */
export function ensureId(el, prefix) {
  if (!el.id) el.id = uid(prefix)
  return el.id
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Элементы, на которые можно попасть клавишей Tab (видимые и не inert). */
export const focusable = (root) =>
  qsa(FOCUSABLE, root).filter((el) => !el.closest('[inert]') && !el.hidden && el.getClientRects().length > 0)

/**
 * Удержать фокус внутри контейнера (модалка, мобильное меню без <dialog>).
 * Нативный <dialog> с showModal() делает это сам — там trapFocus не нужен.
 * @returns {() => void} снять ловушку
 */
export function trapFocus(container) {
  const onKey = (event) => {
    if (event.key !== 'Tab') return
    const items = focusable(container)
    if (!items.length) {
      event.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}

/**
 * Элементы по селектору, принадлежащие ИМЕННО этому компоненту, без элементов
 * вложенных компонентов того же типа (аккордеон внутри аккордеона).
 * Элемент «чужой», если между ним и root есть контейнер `nestedIn`
 * (например, панель другого пункта).
 *   ownElements(root, '[data-accordion-item]', '[data-accordion-panel]')
 * Не опирается на data-module — работает и в React, где атрибута нет.
 */
export function ownElements(root, selector, nestedIn) {
  return qsa(selector, root).filter((el) => {
    const outer = el.parentElement?.closest(nestedIn)
    return !outer || !root.contains(outer)
  })
}

/**
 * Делегирование: один обработчик на родителе для всех потомков по селектору.
 * Работает и для элементов, добавленных позже.
 *   delegate(document, 'click', '[data-dialog-open]', (e, btn) => …)
 * @returns {() => void}
 */
export function delegate(root, type, selector, handler, options) {
  const listener = (event) => {
    const target = event.target.closest?.(selector)
    if (target && root.contains(target)) handler(event, target)
  }
  root.addEventListener(type, listener, options)
  return () => root.removeEventListener(type, listener, options)
}
