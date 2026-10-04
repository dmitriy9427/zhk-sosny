/**
 * Бегущая строка (логотипы партнёров, ключевые слова) — бесконечная, без рывка.
 *
 *   <div class="marquee" data-module="marquee" data-marquee-speed="60">
 *     <div class="marquee__track" data-marquee-track>
 *       <span>Логотип 1</span> <span>Логотип 2</span> …
 *     </div>
 *   </div>
 *
 * ─── Как работает бесконечность ─────────────────────────────────────────────
 * Содержимое track копируется столько раз, чтобы полностью покрыть ширину
 * экрана + ещё один комплект. Лента сдвигается влево; когда сдвиг достиг
 * ширины одного комплекта, он «заворачивается» в 0 (wrap) — картинка в этот
 * момент совпадает с исходной, поэтому скачка не видно.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Рывок при «заворачивании»: ширина комплекта считается через offsetLeft
 *    первого клона (учитывает gap), а не через scrollWidth.
 * 2. Дыра справа на широких экранах: число копий пересчитывается при resize.
 * 3. Скорость зависит от частоты экрана: двигаем на speed * dt (px в секунду).
 * 4. Копии читаются скринридером N раз: клоны получают aria-hidden и inert.
 * 5. Крутится, когда не видна: пауза вне экрана (экономия батареи).
 * @module kit/modules/marquee
 */
import { gsap } from '../../core/gsap.js'
import { createDisposer, onViewport } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { canHover } from '../../core/env.js'
import { wrap } from '../../core/math.js'

const DEFAULTS = {
  /** Скорость, px/с. */
  speed: 60,
  /** Ехать вправо, а не влево. */
  reverse: false,
  /** Останавливаться при наведении мыши. */
  pauseOnHover: true,
}

/** Сколько копий нужно, чтобы покрыть `viewport` и иметь запас на один комплект. */
export const copiesNeeded = (setWidth, viewport) => (setWidth > 0 ? Math.ceil(viewport / setWidth) + 1 : 1)

export default function marquee(root, ctx = {}) {
  const options = readOptions(root, 'marquee', DEFAULTS, ctx.options)
  const track = root.querySelector('[data-marquee-track]')
  if (!track) throw new Error('[kit] marquee: нужен [data-marquee-track] внутри')
  if (ctx.reduced) return // без движения лента остаётся обычным рядом

  const d = createDisposer()
  const originals = Array.from(track.children)
  let clones = []
  let setWidth = 0
  let offset = 0
  let running = false
  let hovered = false

  function build() {
    clones.forEach((c) => c.remove())
    clones = []
    // Ширина комплекта = где начинается первая копия (включает gap).
    const probe = originals.map((node) => node.cloneNode(true))
    probe.forEach((c) => track.append(c))
    setWidth = probe[0].offsetLeft - originals[0].offsetLeft
    probe.forEach((c) => c.remove())

    const copies = copiesNeeded(setWidth, root.offsetWidth)
    for (let i = 0; i < copies; i++) {
      originals.forEach((node) => {
        const clone = node.cloneNode(true)
        clone.setAttribute('aria-hidden', 'true')
        clone.inert = true
        track.append(clone)
        clones.push(clone)
      })
    }
  }

  const tick = (_, deltaMs) => {
    if (hovered || setWidth <= 0) return
    const step = (options.speed * deltaMs) / 1000
    offset = wrap(offset + (options.reverse ? step : -step), -setWidth, 0)
    track.style.transform = `translate3d(${offset}px, 0, 0)`
  }

  const play = () => {
    if (!running) gsap.ticker.add(tick)
    running = true
  }
  const pause = () => {
    gsap.ticker.remove(tick)
    running = false
  }

  build()
  d.add(() => {
    pause()
    clones.forEach((c) => c.remove())
    track.style.transform = ''
  })
  d.add(onViewport(root, { enter: play, leave: pause, rootMargin: '100px' }))

  if (typeof ResizeObserver !== 'undefined') {
    let width = root.offsetWidth
    const ro = new ResizeObserver(() => {
      if (root.offsetWidth === width) return
      width = root.offsetWidth
      build()
    })
    ro.observe(root)
    d.add(() => ro.disconnect())
  }

  if (options.pauseOnHover && canHover()) {
    d.listen(root, 'pointerenter', () => (hovered = true))
    d.listen(root, 'pointerleave', () => (hovered = false))
  }

  return {
    play,
    pause,
    get offset() {
      return offset
    },
    destroy: d.dispose,
  }
}
