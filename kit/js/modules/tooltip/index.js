/**
 * Подсказки (тултипы) для любых элементов — без data-module и регистрации.
 *
 *   <button aria-label="Удалить" data-tooltip>…иконка…</button>        текст = aria-label
 *   <a href="/pdf" data-tooltip="Скачать прайс, 2 МБ">Прайс</a>
 *   <span data-tooltip="Подробнее" data-tooltip-placement="right">?</span>
 *   <abbr data-tooltip-template="#vat-help">НДС</abbr>                 разметка из <template id="vat-help">
 *
 * Подключение — один раз на весь сайт (плагин src/plugins/03-tooltips.js):
 *   import { createTooltips } from 'kit/js/modules/tooltip/index.js'
 *   export default () => createTooltips().destroy
 *
 * ─── Как устроено ───────────────────────────────────────────────────────────
 * - ОДИН элемент подсказки на страницу и делегирование событий на document:
 *   работает для элементов, добавленных позже (htmx, компоненты, React), и
 *   не плодит сотни обработчиков.
 * - Позиция — Floating UI: сверху, а если не помещается — снизу (flip),
 *   сдвиг от края экрана (shift), стрелка смотрит на элемент, позиция
 *   обновляется при прокрутке и ресайзе, пока подсказка видна.
 * - popover="manual" — «верхний слой» браузера: подсказка видна поверх
 *   модалки <dialog> и не обрезается overflow: hidden у предков.
 *
 * ─── Доступность ────────────────────────────────────────────────────────────
 * - Показ при наведении мыши (с задержкой) и при фокусе с клавиатуры
 *   (:focus-visible — клик мышью по кнопке подсказку не вызывает).
 * - role="tooltip" + aria-describedby на элементе, пока подсказка видна.
 * - Esc прячет подсказку, не закрывая модалку под ней.
 * - На тач-экранах наведения нет — важное не прячьте ТОЛЬКО в подсказку.
 *   Иконке-кнопке нужен aria-label; data-tooltip без значения покажет его же.
 * @module kit/modules/tooltip
 */
import { arrow, autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'

const DEFAULTS = {
  /** Задержка показа при наведении, мс (чтобы не мигало при проводке мышью). */
  delay: 350,
  /** Отступ от элемента, px. */
  offset: 8,
  /** Сторона по умолчанию: top | bottom | left | right (+ -start/-end). */
  placement: 'top',
}

const SELECTOR = '[data-tooltip], [data-tooltip-template]'
let count = 0

/** Текст или разметка подсказки для элемента (null — показывать нечего). */
export function tooltipContent(el) {
  const templateId = el.getAttribute('data-tooltip-template')
  if (templateId) {
    const template = document.querySelector(templateId)
    return template instanceof HTMLTemplateElement ? template.content.cloneNode(true) : null
  }
  const text = el.getAttribute('data-tooltip') || el.getAttribute('aria-label') || ''
  return text.trim() ? text : null
}

/**
 * Включить подсказки на странице.
 * @param {Partial<typeof DEFAULTS> & { root?: Document | HTMLElement }} [o]
 * @returns {{ show: (el: Element) => void, hide: () => void, destroy: () => void, readonly element: HTMLElement }}
 */
export function createTooltips({ root = document, ...overrides } = {}) {
  const options = { ...DEFAULTS, ...overrides }
  const tip = document.createElement('div')
  tip.className = 'tooltip'
  tip.id = `kit-tooltip-${++count}`
  tip.setAttribute('role', 'tooltip')
  const body = document.createElement('div')
  body.className = 'tooltip__body'
  const arrowEl = document.createElement('span')
  arrowEl.className = 'tooltip__arrow'
  tip.append(body, arrowEl)
  const canPopover = typeof tip.showPopover === 'function'
  if (canPopover) tip.popover = 'manual'
  tip.hidden = true
  document.body.append(tip)

  /** @type {HTMLElement | null} */
  let current = null
  let timer = 0
  let stopAutoUpdate = null

  async function place() {
    if (!current) return
    const placement = /** @type {any} */ (current.getAttribute('data-tooltip-placement') || options.placement)
    const {
      x,
      y,
      placement: final,
      middlewareData,
    } = await computePosition(current, tip, {
      strategy: 'fixed',
      placement,
      middleware: [offset(options.offset), flip(), shift({ padding: 8 }), arrow({ element: arrowEl, padding: 6 })],
    })
    Object.assign(tip.style, { left: `${x}px`, top: `${y}px` })
    tip.dataset.placement = final.split('-')[0]
    const a = middlewareData.arrow
    Object.assign(arrowEl.style, { left: a?.x != null ? `${a.x}px` : '', top: a?.y != null ? `${a.y}px` : '' })
  }

  function show(el) {
    clearTimeout(timer)
    const content = tooltipContent(el)
    if (!content) return
    if (current && current !== el) hide()
    current = /** @type {HTMLElement} */ (el)
    body.replaceChildren(content)
    tip.hidden = false
    if (canPopover && !tip.matches(':popover-open')) tip.showPopover()
    // Подсказка — описание, а не имя: не дублируем, если текст = aria-label.
    if (el.getAttribute('aria-label') !== body.textContent) {
      const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
      if (!ids.includes(tip.id)) el.setAttribute('aria-describedby', [...ids, tip.id].join(' '))
    }
    stopAutoUpdate?.()
    stopAutoUpdate = autoUpdate(el, tip, place)
    requestAnimationFrame(() => tip.classList.add('is-visible'))
  }

  function hide() {
    clearTimeout(timer)
    if (!current) return
    const ids = (current.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== tip.id)
    if (ids.length) current.setAttribute('aria-describedby', ids.join(' '))
    else current.removeAttribute('aria-describedby')
    current = null
    stopAutoUpdate?.()
    stopAutoUpdate = null
    tip.classList.remove('is-visible')
    tip.hidden = true
    if (canPopover && tip.matches(':popover-open')) tip.hidePopover()
  }

  const target = (event) => /** @type {Element} */ (event.target)?.closest?.(SELECTOR)

  const onOver = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return
    const el = target(event)
    if (!el || el === current) return
    clearTimeout(timer)
    // Уже показана другая подсказка — переключаем сразу (как в системных тултипах).
    if (current) show(el)
    else timer = window.setTimeout(() => show(el), options.delay)
  }
  const onOut = (event) => {
    const el = target(event)
    if (!el || el.contains(/** @type {Node} */ (event.relatedTarget))) return
    if (el === current) hide()
    else clearTimeout(timer)
  }
  const onFocus = (event) => {
    const el = target(event)
    if (el && el.matches(':focus-visible')) show(el)
  }
  const onBlur = (event) => {
    if (target(event) === current) hide()
  }
  const onKey = (event) => {
    if (event.key === 'Escape' && current) {
      hide()
      // Не даём Esc закрыть модалку под подсказкой: первый Esc — подсказке.
      event.stopPropagation()
      event.preventDefault()
    }
  }
  // Клик (нажали кнопку) — подсказка больше не нужна.
  const onDown = () => hide()

  root.addEventListener('pointerover', onOver)
  root.addEventListener('pointerout', onOut)
  root.addEventListener('focusin', onFocus)
  root.addEventListener('focusout', onBlur)
  root.addEventListener('pointerdown', onDown)
  document.addEventListener('keydown', onKey, true)

  return {
    show,
    hide,
    get element() {
      return tip
    },
    destroy() {
      hide()
      root.removeEventListener('pointerover', onOver)
      root.removeEventListener('pointerout', onOut)
      root.removeEventListener('focusin', onFocus)
      root.removeEventListener('focusout', onBlur)
      root.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
      tip.remove()
    },
  }
}

/**
 * Модуль-вариант: подсказки только внутри блока (обычно хватает плагина на весь сайт).
 *   <div data-module="tooltip">…[data-tooltip]…</div>
 */
export default function tooltip(el, ctx = {}) {
  return createTooltips({ root: el, ...(ctx.options ?? {}) })
}
