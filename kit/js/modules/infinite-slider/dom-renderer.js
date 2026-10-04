/**
 * DOM-рендерер бесконечной ленты.
 *
 * Получает от движка (engine.js) смещение каждого слайда от центра и
 * скорость ленты, и превращает это в CSS:
 *   - translate3d — где слайд;
 *   - skewX — наклон на скорости (лента «гнётся», как от ветра);
 *   - scale + переменная --dim — боковые слайды чуть меньше и темнее;
 *   - картинка внутри слайда сдвигается в обратную сторону — параллакс
 *     (окно-слайд едет быстрее, чем «вид» в окне).
 * Слайды далеко за краем получают visibility: hidden — браузеру меньше работы.
 *
 * Тот же интерфейс { resize, render, dispose } у WebGL-рендерера
 * (gl-renderer.js) — поэтому движок не знает, чем его рисуют.
 * @module kit/modules/infinite-slider/dom-renderer
 */
import { clamp } from '../../core/math.js'

/**
 * @param {HTMLElement[]} slides
 * @param {{ skew?: number, parallax?: number }} [options]
 */
export function createDomRenderer(slides, { skew = 10, parallax = 0.18 } = {}) {
  /** @type {(HTMLElement | null)[]} */
  const arts = slides.map((slide) => slide.querySelector('[data-infinite-art]'))
  let width = 0
  let slideWidth = 0

  return {
    resize(viewportWidth, nextSlideWidth) {
      width = viewportWidth
      slideWidth = nextSlideWidth
    },
    /** @param {ReturnType<typeof import('./engine.js').createInfiniteEngine>} engine */
    render(engine) {
      const skewX = (-engine.speed * skew).toFixed(2)

      slides.forEach((slide, i) => {
        const offset = engine.offset(i)
        const distance = clamp(Math.abs(offset) / Math.max(width, 1), 0, 1)
        const x = width / 2 + offset - slideWidth / 2
        // Слайды далеко за краем не трогаем — браузеру меньше работы.
        const visible = Math.abs(offset) < width / 2 + slideWidth

        slide.style.visibility = visible ? 'visible' : 'hidden'
        if (!visible) return

        slide.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) skewX(${skewX}deg) scale(${(1 - distance * 0.12).toFixed(4)})`
        slide.style.setProperty('--dim', (distance * 0.7).toFixed(3))
        if (arts[i]) arts[i].style.transform = `translate3d(${(-offset * parallax).toFixed(1)}px, 0, 0) scale(1.25)`
      })
    },
    dispose() {
      slides.forEach((slide, i) => {
        slide.style.removeProperty('transform')
        slide.style.removeProperty('visibility')
        slide.style.removeProperty('--dim')
        arts[i]?.style.removeProperty('transform')
      })
    },
  }
}
