/**
 * Кнопка «Наверх»: появляется после прокрутки на N px.
 *
 *   <button class="scroll-top" data-module="scroll-top" aria-label="Наверх">↑</button>
 *
 * Прокрутка через ctx.scroll (Lenis), если он есть, иначе нативно. После
 * прокрутки фокус переносится в начало страницы (на ссылку skip-link или
 * <body>) — иначе пользователь клавиатуры остаётся «внизу».
 * @module kit/modules/scroll-top
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { rafThrottle } from '../../core/timing.js'

const DEFAULTS = {
  /** После какой прокрутки показать: число px или доля высоты окна (≤ 1). */
  after: 1,
}

export default function scrollTop(el, ctx = {}) {
  const options = readOptions(el, 'scroll-top', DEFAULTS, ctx.options)
  const d = createDisposer()
  const threshold = () => (options.after <= 1 ? window.innerHeight * options.after : options.after)

  const update = rafThrottle(() => el.classList.toggle('is-visible', window.scrollY > threshold()))
  update()
  d.add(update.cancel)
  d.listen(window, 'scroll', update, { passive: true })

  d.listen(el, 'click', () => {
    if (ctx.scroll) ctx.scroll.scrollTo(0, { offset: 0 })
    else window.scrollTo({ top: 0, behavior: ctx.reduced ? 'auto' : 'smooth' })
    /** @type {HTMLElement} */
    const first = document.querySelector('.skip-link') ?? document.body
    if (first === document.body) document.body.tabIndex = -1
    first.focus({ preventScroll: true })
  })

  return { destroy: d.dispose }
}
