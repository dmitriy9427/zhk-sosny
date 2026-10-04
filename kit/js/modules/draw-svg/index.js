/**
 * Линии SVG «рисуются» при прокрутке (схемы, подчёркивания, маршруты, подписи).
 *
 *   <svg data-module="draw-svg" viewBox="…"> <path d="…" data-draw /> </svg>
 *   <svg data-module="draw-svg" data-draw-svg-scrub> …                ← привязать к скроллу
 *
 * Рисуются все path/line/polyline/circle с data-draw (или все, если меток нет).
 * Работает только с обводкой (stroke), не с заливкой.
 * @module kit/modules/draw-svg
 */
import { gsap } from '../../core/gsap.js'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { readOptions } from '../../core/options.js'

gsap.registerPlugin(DrawSVGPlugin)

const DEFAULTS = {
  /** Привязать прогресс к прокрутке (true) или проиграть один раз (false). */
  scrub: false,
  duration: 1.6,
  start: 'top 80%',
  stagger: 0.15,
}

export default function drawSvg(svg, ctx = {}) {
  const options = readOptions(svg, 'draw-svg', DEFAULTS, ctx.options)
  const marked = svg.querySelectorAll('[data-draw]')
  const shapes = marked.length ? marked : svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect')
  if (!shapes.length || ctx.reduced) return undefined
  const tween = gsap.fromTo(
    shapes,
    { drawSVG: '0%' },
    {
      drawSVG: '100%',
      duration: options.duration,
      stagger: options.stagger,
      ease: options.scrub ? 'none' : 'power2.inOut',
      scrollTrigger: options.scrub
        ? { trigger: svg, start: 'top bottom', end: 'bottom center', scrub: true }
        : { trigger: svg, start: options.start, once: true },
    },
  )
  return {
    destroy() {
      tween.scrollTrigger?.kill()
      tween.kill()
      gsap.set(shapes, { clearProps: 'strokeDasharray,strokeDashoffset' })
    },
  }
}
