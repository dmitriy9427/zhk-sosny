/**
 * Свой курсор: точка + кольцо, которое догоняет с запаздыванием, растёт над
 * ссылками и показывает подсказку («Смотреть», «Тянуть»).
 *
 *   <div class="cursor" data-module="cursor"></div>       ← один раз в конце <body>
 *   <a href="…" data-cursor="Смотреть">…</a>              ← подсказка в кольце
 *   <div data-cursor="Тянуть" data-cursor-size="96">…</div>
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. На тач-экранах свой курсор бесполезен и «висит» в углу — модуль не
 *    запускается без мыши (canHover).
 * 2. Системный курсор пропадал и над полями ввода — там, где нужно видеть
 *    каретку, системный курсор остаётся (input, textarea, select, [contenteditable]).
 * 3. Курсор «застывал» у края, когда мышь уходила из окна — прячется на mouseleave.
 * 4. Подсказки на элементах, добавленных позже, — делегирование событий.
 * Подписка на движение мыши через gsap.quickTo — плавно и без утечек.
 * @module kit/modules/cursor
 */
import { gsap } from '../../core/gsap.js'
import { createDisposer } from '../../core/lifecycle.js'
import { canHover } from '../../core/env.js'

const INTERACTIVE = 'a, button, [role="button"], label, summary, [data-cursor]'
const TEXT_INPUT = 'input, textarea, select, [contenteditable]'

export default function cursor(el, ctx = {}) {
  if (!canHover() || ctx.reduced) {
    el.hidden = true
    return undefined
  }
  const d = createDisposer()
  el.innerHTML =
    '<span class="cursor__dot"></span><span class="cursor__ring"><span class="cursor__label"></span></span>'
  el.setAttribute('aria-hidden', 'true')
  const dot = el.querySelector('.cursor__dot')
  const ring = el.querySelector('.cursor__ring')
  const label = el.querySelector('.cursor__label')
  document.documentElement.classList.add('has-cursor')
  d.add(() => document.documentElement.classList.remove('has-cursor'))

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.08 })
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.08 })
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' })
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' })

  d.listen(window, 'pointermove', (event) => {
    if (event.pointerType !== 'mouse') return
    el.classList.add('is-visible')
    dotX(event.clientX)
    dotY(event.clientY)
    ringX(event.clientX)
    ringY(event.clientY)
  })
  d.listen(document, 'mouseleave', () => el.classList.remove('is-visible'))
  d.listen(document, 'pointerover', (event) => {
    const target = event.target.closest?.(INTERACTIVE)
    const text = event.target.closest?.(TEXT_INPUT)
    el.classList.toggle('is-text', Boolean(text))
    el.classList.toggle('is-hover', Boolean(target))
    const hint = target?.dataset.cursor ?? ''
    label.textContent = hint
    el.classList.toggle('has-label', Boolean(hint))
    el.style.setProperty('--cursor-size', target?.dataset.cursorSize ? `${target.dataset.cursorSize}px` : '')
  })
  d.listen(window, 'pointerdown', () => el.classList.add('is-pressed'))
  d.listen(window, 'pointerup', () => el.classList.remove('is-pressed'))
  d.add(() => {
    gsap.killTweensOf([dot, ring])
    el.replaceChildren()
  })
  return { destroy: d.dispose }
}
