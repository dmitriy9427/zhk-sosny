/**
 * Слайдер-карусель на CSS scroll-snap.
 *
 *   <div class="slider" data-module="slider">
 *     <div class="slider__track" data-slider-track>
 *       <div class="slider__slide">…</div> …
 *     </div>
 *     <button class="slider__arrow" data-slider-prev aria-label="Назад">←</button>
 *     <button class="slider__arrow" data-slider-next aria-label="Вперёд">→</button>
 *     <div class="slider__dots" data-slider-dots></div>
 *   </div>
 *
 * Ширина слайда и отступ — CSS-переменные на .slider:
 *   style="--slide-width: 80%; --slide-gap: 16px" (адаптив — в своих стилях).
 *
 * ─── Почему scroll-snap, а не transform ─────────────────────────────────────
 * Прокрутку делает браузер: родная инерция пальца на телефоне, тачпад,
 * Shift+колесо, доступность «из коробки», ноль кода на расчёт физики.
 * JS только добавляет стрелки, точки, перетаскивание мышью и автопрокрутку.
 * Ограничение: нет бесконечной петли. Нужна петля или эффекты (fade, 3D) —
 * используйте Swiper или Embla (см. docs/recipes.md).
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Перетаскивание мышью с включённым snap «дёргается» — на время drag
 *    snap выключается (класс is-dragging), после — плавно доводится.
 * 2. После перетаскивания срабатывает клик по ссылке в слайде — гасим клик,
 *    если мышь сдвинулась больше чем на 5px.
 * 3. Картинки перетаскиваются как файлы (ghost image) — draggable=false.
 * 4. Стрелки не блокируются на краях — следим за scroll и ставим disabled.
 * 5. Автопрокрутка мешает читать — пауза при наведении, фокусе, вне экрана
 *    и при reduced motion.
 * @module kit/modules/slider
 */
import { createDisposer, onViewport } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { rafThrottle } from '../../core/timing.js'
import { t } from '../../core/i18n.js'

const DEFAULTS = {
  /** Автопрокрутка, мс между слайдами. 0 — выключена. */
  autoplay: 0,
  /** Подпись точки для скринридеров; {n} заменится номером. */
  dotLabel: '',
}

/** Индекс слайда, чей левый край ближе всего к текущей прокрутке. */
export function nearestIndex(offsets, scrollLeft) {
  let best = 0
  offsets.forEach((x, i) => {
    if (Math.abs(x - scrollLeft) < Math.abs(offsets[best] - scrollLeft)) best = i
  })
  return best
}

export default function slider(root, ctx = {}) {
  const options = readOptions(root, 'slider', DEFAULTS, ctx.options)
  const track = root.querySelector('[data-slider-track]')
  if (!track) throw new Error('[kit] slider: нужен [data-slider-track]')

  const d = createDisposer()
  const slides = Array.from(track.children)
  const prev = root.querySelector('[data-slider-prev]')
  const next = root.querySelector('[data-slider-next]')
  const dotsBox = root.querySelector('[data-slider-dots]')
  const behavior = ctx.reduced ? 'auto' : 'smooth'

  root.setAttribute('role', 'region')
  root.setAttribute('aria-roledescription', t('kit.slider.carousel'))
  track.tabIndex = 0 // стрелки клавиатуры прокручивают ленту, когда она в фокусе
  slides.forEach((slide, i) => {
    slide.setAttribute('role', 'group')
    slide.setAttribute('aria-label', t('kit.slider.of', { n: i + 1, total: slides.length }))
  })
  root.querySelectorAll('img').forEach((img) => (img.draggable = false))

  // Позиция слайда относительно начала ленты (учитывает padding и gap).
  const offsets = () => slides.map((s) => s.offsetLeft - slides[0].offsetLeft)
  const maxScroll = () => track.scrollWidth - track.clientWidth
  const current = () => nearestIndex(offsets(), track.scrollLeft)

  function goTo(index) {
    const i = Math.max(0, Math.min(slides.length - 1, index))
    track.scrollTo({ left: offsets()[i], behavior })
  }

  const dots = dotsBox
    ? slides.map((_, i) => {
        const dot = document.createElement('button')
        dot.type = 'button'
        dot.className = 'slider__dot'
        dot.setAttribute(
          'aria-label',
          options.dotLabel ? options.dotLabel.replace('{n}', String(i + 1)) : t('kit.slider.slide', { n: i + 1 }),
        )
        dot.addEventListener('click', () => goTo(i))
        dotsBox.append(dot)
        return dot
      })
    : []
  d.add(() => dots.forEach((dot) => dot.remove()))

  const update = rafThrottle(() => {
    const index = current()
    const max = maxScroll()
    if (prev) prev.disabled = track.scrollLeft <= 1
    if (next) next.disabled = track.scrollLeft >= max - 1
    root.classList.toggle('is-static', max <= 1) // всё влезло — стрелки не нужны
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)))
    root.dispatchEvent(new CustomEvent('slider:change', { detail: { index } }))
  })
  d.add(update.cancel)
  update()
  d.listen(track, 'scroll', update, { passive: true })
  d.listen(window, 'resize', update)

  if (prev) d.listen(prev, 'click', () => goTo(current() - 1))
  if (next) d.listen(next, 'click', () => goTo(current() + 1))

  // ─── Перетаскивание мышью (палец и тачпад браузер обрабатывает сам) ──────
  let drag = null
  let moved = false
  d.listen(track, 'pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    drag = { x: event.clientX, left: track.scrollLeft }
    moved = false
  })
  d.listen(window, 'pointermove', (event) => {
    if (!drag) return
    const dx = event.clientX - drag.x
    if (!moved && Math.abs(dx) > 5) {
      moved = true
      root.classList.add('is-dragging')
    }
    if (moved) track.scrollLeft = drag.left - dx
  })
  d.listen(window, 'pointerup', () => {
    if (!drag) return
    drag = null
    if (!moved) return
    root.classList.remove('is-dragging')
    goTo(current())
  })
  d.listen(
    track,
    'click',
    (event) => {
      if (moved) {
        event.preventDefault()
        event.stopPropagation()
        moved = false
      }
    },
    true,
  )

  // ─── Автопрокрутка ──────────────────────────────────────────────────────
  if (options.autoplay > 0 && !ctx.reduced) {
    let timer = 0
    let visible = false
    let paused = false
    const schedule = () => {
      clearInterval(timer)
      if (!visible || paused) return
      timer = window.setInterval(() => {
        const i = current()
        goTo(track.scrollLeft >= maxScroll() - 1 ? 0 : i + 1)
      }, options.autoplay)
    }
    const setPaused = (value) => () => {
      paused = value
      schedule()
    }
    d.listen(root, 'pointerenter', setPaused(true))
    d.listen(root, 'pointerleave', setPaused(false))
    d.listen(root, 'focusin', setPaused(true))
    d.listen(root, 'focusout', setPaused(false))
    d.add(
      onViewport(root, {
        enter: () => ((visible = true), schedule()),
        leave: () => ((visible = false), schedule()),
      }),
    )
    d.add(() => clearInterval(timer))
  }

  return {
    goTo,
    next: () => goTo(current() + 1),
    prev: () => goTo(current() - 1),
    get index() {
      return current()
    },
    destroy: d.dispose,
  }
}
