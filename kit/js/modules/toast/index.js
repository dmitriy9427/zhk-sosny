/**
 * Всплывающие уведомления («тосты»).
 *
 *   import { toast } from 'kit/js/modules/toast'
 *   toast('Сохранено', { type: 'success' })
 *   toast('Ошибка сети', { type: 'error', duration: 0 })   // 0 — висит, пока не закроют
 *
 * Или без JS-кода, кнопкой: <button data-toast="Скопировано" data-toast-type="success">
 * (для этого подключите модуль: data-module="toast" на <body> или любой обёртке).
 *
 * Доступность: контейнер — aria-live регион, скринридер зачитывает новый тост,
 * не уводя фокус. Ошибки — role="alert" (зачитываются немедленно).
 * Тост не исчезает, пока на нём мышь или фокус — человек успеет дочитать.
 * @module kit/modules/toast
 */
import { delegate } from '../../core/dom.js'
import { t } from '../../core/i18n.js'

let region = null

function getRegion() {
  if (region?.isConnected) return region
  region = document.createElement('div')
  region.className = 'toasts'
  region.setAttribute('aria-live', 'polite')
  region.setAttribute('aria-relevant', 'additions')
  document.body.append(region)
  return region
}

/**
 * @param {string} message
 * @param {{ type?: 'info'|'success'|'warning'|'error', duration?: number, closeLabel?: string }} [o]
 * @returns {{ close: () => void, el: HTMLElement }}
 */
export function toast(message, { type = 'info', duration = 4000, closeLabel = t('kit.toast.close') } = {}) {
  const el = document.createElement('div')
  el.className = `toast toast--${type}`
  if (type === 'error') el.setAttribute('role', 'alert')
  const text = document.createElement('p')
  text.className = 'toast__text'
  text.textContent = message // textContent, не innerHTML: сообщение может прийти с сервера (XSS)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'toast__close'
  button.setAttribute('aria-label', closeLabel)
  button.textContent = '×'
  el.append(text, button)
  getRegion().append(el)

  let timer = 0
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearTimeout(timer)
    el.classList.add('is-leaving')
    // Ждём анимацию ухода; страховка — если анимаций нет (reduced motion).
    const remove = () => el.remove()
    el.addEventListener('animationend', remove, { once: true })
    setTimeout(remove, 400)
  }
  const arm = () => {
    clearTimeout(timer)
    if (duration > 0) timer = window.setTimeout(close, duration)
  }
  const hold = () => clearTimeout(timer)

  button.addEventListener('click', close)
  el.addEventListener('pointerenter', hold)
  el.addEventListener('pointerleave', arm)
  el.addEventListener('focusin', hold)
  el.addEventListener('focusout', arm)
  arm()
  return { close, el }
}

/** Модуль: кнопки с data-toast внутри root показывают тост по клику. */
export default function toastTriggers(root) {
  const off = delegate(root, 'click', '[data-toast]', (_, button) => {
    toast(button.dataset.toast, { type: button.dataset.toastType || 'info' })
  })
  return { destroy: off }
}
