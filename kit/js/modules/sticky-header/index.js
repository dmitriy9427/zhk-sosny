/**
 * Шапка: прячется при прокрутке вниз, появляется при прокрутке вверх.
 *
 *   <header class="header" data-module="sticky-header"> … </header>
 *
 * Классы на шапке: is-scrolled (ушли от верха), is-hidden (спрятана).
 * Стили — scss/components/_header.scss.
 *
 * ─── Что ещё делает ─────────────────────────────────────────────────────────
 * Пишет реальную высоту шапки в --header-height на <html>. Её используют:
 * якоря (scroll-padding-top) — заголовок не прячется под шапкой; отступ
 * контента сверху; позиция мобильного меню.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Шапка прячется, пока открыто меню (прокрутка заблокирована, но Lenis
 *    успевает сдвинуться) — при блокировке прокрутки не прячем.
 * 2. «Дрожание» у самого верха и на iOS при резинке — порог tolerance и
 *    игнор отрицательной прокрутки.
 * 3. Шапка спрятана, а пользователь переходит по ней Tab-ом — при фокусе
 *    внутри шапки показываем её.
 * @module kit/modules/sticky-header
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { isScrollLocked } from '../../core/scroll-lock.js'
import { rafThrottle } from '../../core/timing.js'

const DEFAULTS = {
  /** Прятать при прокрутке вниз. */
  hide: true,
  /** С какой прокрутки (px) включается is-scrolled и прятание. */
  offset: 80,
  /** Минимальный сдвиг (px), чтобы сменить состояние — против дрожания. */
  tolerance: 8,
}

/** Чистая логика: новое состояние «спрятана?» по прокрутке. */
export function nextHidden({ y, lastY, hidden, offset, tolerance }) {
  if (y <= offset) return false
  const delta = y - lastY
  if (Math.abs(delta) < tolerance) return hidden
  return delta > 0
}

export default function stickyHeader(el, ctx = {}) {
  const options = readOptions(el, 'sticky-header', DEFAULTS, ctx.options)
  const d = createDisposer()
  const root = document.documentElement
  let lastY = Math.max(0, window.scrollY)
  let hidden = false

  const setHeight = () => root.style.setProperty('--header-height', `${el.offsetHeight}px`)
  setHeight()
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(setHeight)
    ro.observe(el)
    d.add(() => ro.disconnect())
  }

  const update = rafThrottle(() => {
    const y = Math.max(0, window.scrollY)
    el.classList.toggle('is-scrolled', y > options.offset)
    if (options.hide && !isScrollLocked() && !el.contains(document.activeElement)) {
      hidden = nextHidden({ y, lastY, hidden, offset: options.offset, tolerance: options.tolerance })
      el.classList.toggle('is-hidden', hidden)
    }
    if (Math.abs(y - lastY) >= options.tolerance || y <= options.offset) lastY = y
  })
  update()
  d.add(update.cancel)
  d.listen(window, 'scroll', update, { passive: true })
  d.listen(el, 'focusin', () => {
    hidden = false
    el.classList.remove('is-hidden')
  })
  d.add(() => {
    el.classList.remove('is-scrolled', 'is-hidden')
    root.style.removeProperty('--header-height')
  })

  return { show: () => el.classList.remove('is-hidden'), destroy: d.dispose }
}
