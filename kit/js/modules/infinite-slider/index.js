/**
 * Бесконечная лента слайдов — обычная (DOM) или 3D-«барабан» (WebGL).
 *
 *   <div class="infinite" data-module="infinite-slider" data-infinite-slider-mode="3d">
 *     <div class="infinite__viewport" data-infinite-viewport tabindex="0" aria-roledescription="карусель">
 *       <figure class="infinite__slide" data-infinite-slide data-title="Москва">
 *         <div class="infinite__art" data-infinite-art><img src="1.jpg" alt="…"></div>
 *       </figure>
 *       … (не меньше 3 слайдов)
 *     </div>
 *     <p class="infinite__title" data-infinite-title></p>     ← подпись активного (по желанию)
 *     <p class="infinite__counter" data-infinite-counter></p> ← «01 / 08» (по желанию)
 *     <button data-infinite-prev>←</button> <button data-infinite-next>→</button>
 *   </div>
 *
 * ─── Что умеет ───────────────────────────────────────────────────────────────
 * Ряд без начала и конца. Тянут мышью/пальцем — лента едет за рукой и
 * наклоняется на скорости; отпустили — докатывается пружиной до ближайшего
 * слайда, сильный бросок пролистывает несколько. Ещё: кнопки, стрелки
 * клавиатуры, горизонтальное колесо тачпада, клик по боковому слайду.
 * 3D: слайды на изогнутом барабане с отражением в «полу» и RGB-расслоением
 * на скорости. Без WebGL — сама откатывается на DOM-версию.
 *
 * ─── Устройство ──────────────────────────────────────────────────────────────
 *   engine.js       — логика (позиции, пружина, бросок), без DOM — тесты engine.test.js;
 *   dom-renderer.js — рисует CSS-трансформами;
 *   gl-renderer.js  — рисует в WebGL (three.js грузится только для mode="3d");
 *   index.js        — жесты → движок → рендерер, кадры на gsap.ticker.
 * Кадр рисуется, только пока лента видна и движется — в покое ноль работы.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Вертикальный свайп пальцем по ленте не прокручивал страницу — Observer
 *    с lockAxis: начали тянуть вертикально — жест отдаётся странице.
 * 2. Вертикальное колесо «застревало» в ленте — слушаем только горизонтальное.
 * 3. Клик по слайду после перетаскивания — переход к слайду не срабатывает,
 *    если рука сдвинулась.
 * 4. Скорость ленты зависела от частоты экрана — пружина считает в секундах.
 * 5. Текстура WebGL из незагруженной картинки чёрная — картинки грузятся заранее.
 * @module kit/modules/infinite-slider
 */
import { gsap } from '../../core/gsap.js'
import { Observer } from 'gsap/Observer'
import { createDisposer, onViewport } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { loadImage, supportsWebGL } from '../../core/webgl.js'
import { t } from '../../core/i18n.js'
import { createInfiniteEngine } from './engine.js'
import { createDomRenderer } from './dom-renderer.js'

gsap.registerPlugin(Observer)

/** Пауза колеса, после которой лента доводится до слайда, мс. */
export const WHEEL_IDLE = 140

const DEFAULTS = {
  /** 'dom' — CSS-трансформы, '3d' — WebGL-барабан. */
  mode: 'dom',
  /** Наклон слайдов на скорости, градусы (DOM). */
  skew: 10,
  /** Параллакс картинки внутри слайда (DOM), 0 — выкл. */
  parallax: 0.18,
  /** Изгиб барабана (3D): 0 — плоско, 1.5 — сильно. */
  curve: 1.1,
  /** Отражение в «полу» (3D), 0 — без отражения. */
  reflection: 0.35,
  /** Время доводки до слайда, с. */
  snap: 0.75,
  /** Пружинистость доводки: 0 — без отскока. */
  bounce: 0.18,
}

export default async function infiniteSlider(el, ctx = {}) {
  const options = readOptions(el, 'infinite-slider', DEFAULTS, ctx.options)
  const d = createDisposer()
  const viewport = el.querySelector('[data-infinite-viewport]')
  const slides = Array.from(el.querySelectorAll('[data-infinite-slide]'))
  const title = el.querySelector('[data-infinite-title]')
  const counter = el.querySelector('[data-infinite-counter]')
  if (!viewport) throw new Error('[kit] infinite-slider: нужен [data-infinite-viewport]')
  if (slides.length < 3) {
    console.warn('[kit] infinite-slider: для бесконечной ленты нужно хотя бы 3 слайда', el)
    return undefined
  }

  // ─── Рендерер: 3D или DOM ────────────────────────────────────────────────
  let renderer
  if (options.mode === '3d' && supportsWebGL()) {
    const sources = slides.map((slide) => {
      const img = slide.querySelector('img')
      return img?.currentSrc || img?.src
    })
    const [{ createGlRenderer }, images] = await Promise.all([
      import('./gl-renderer.js'),
      Promise.all(sources.map(loadImage)),
    ])
    if (d.disposed) return undefined
    el.classList.add('is-gl')
    renderer = createGlRenderer(
      viewport,
      images,
      { dpr: Math.min(window.devicePixelRatio || 1, 2) },
      {
        curve: options.curve,
        reflection: options.reflection,
      },
    )
    d.add(() => el.classList.remove('is-gl'))
  } else {
    renderer = createDomRenderer(slides, {
      skew: ctx.reduced ? 0 : options.skew,
      parallax: ctx.reduced ? 0 : options.parallax,
    })
  }
  d.add(() => renderer.dispose())

  const engine = createInfiniteEngine({
    count: slides.length,
    lag: ctx.reduced ? 0 : 0.08,
    snapDuration: ctx.reduced ? 0.2 : options.snap,
    bounce: ctx.reduced ? 0 : options.bounce,
  })
  let dirty = true
  let index = -1
  let inView = false
  let moved = false

  viewport.setAttribute(
    'aria-roledescription',
    viewport.getAttribute('aria-roledescription') ?? t('kit.slider.carousel'),
  )
  if (!viewport.hasAttribute('tabindex')) viewport.tabIndex = 0

  const measure = () => {
    const gap = parseFloat(getComputedStyle(el).getPropertyValue('--infinite-gap')) || 24
    const slideWidth = slides[0].offsetWidth || 1
    engine.setSize(slideWidth + gap)
    renderer.resize(viewport.clientWidth, slideWidth, slides[0].offsetHeight || 1, viewport.clientHeight)
    dirty = true
  }

  const updateLabels = () => {
    const next = engine.targetIndex
    if (next === index) return
    index = next
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index)
      slide.setAttribute('aria-hidden', String(i !== index))
    })
    if (counter)
      counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`
    if (title) {
      const text = slides[index].dataset.title ?? ''
      // Текст меняется сразу (а не после анимации) — подпись не «опаздывает» за слайдом.
      title.textContent = text
      if (!ctx.reduced)
        gsap.fromTo(
          title,
          { yPercent: 60, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', overwrite: true },
        )
    }
    el.dispatchEvent(new CustomEvent('infinite-slider:change', { bubbles: true, detail: { index } }))
  }

  const tick = (_time, deltaMs) => {
    if (!inView) return
    const moving = engine.step(Math.min(deltaMs / 1000, 0.05))
    if (moving || dirty) {
      renderer.render(engine)
      dirty = false
      updateLabels()
    }
  }
  gsap.ticker.add(tick)
  d.add(() => gsap.ticker.remove(tick))
  d.add(
    onViewport(el, {
      rootMargin: '200px',
      enter: () => ((inView = true), (dirty = true)),
      leave: () => (inView = false),
    }),
  )

  // ─── Жесты ───────────────────────────────────────────────────────────────
  const observer = Observer.create({
    target: viewport,
    type: 'pointer,touch',
    dragMinimum: 4,
    lockAxis: true, // баг 1
    onPress: () => {
      moved = false
      engine.press()
    },
    onDrag: (self) => {
      if (self.axis === 'y') return
      moved = true
      el.classList.add('is-dragging')
      engine.drag(self.deltaX)
    },
    onRelease: (self) => {
      el.classList.remove('is-dragging')
      engine.release(self.axis === 'y' ? 0 : self.velocityX)
    },
  })
  d.add(() => observer.kill())

  let wheelTimer = 0
  d.listen(
    viewport,
    'wheel',
    (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return // баг 2
      event.preventDefault()
      engine.drag(-event.deltaX)
      clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(() => engine.release(0), WHEEL_IDLE)
    },
    { passive: false },
  )
  d.add(() => clearTimeout(wheelTimer))
  d.listen(viewport, 'dragstart', (event) => event.preventDefault())

  slides.forEach((slide, i) => d.listen(slide, 'click', () => !moved && engine.goTo(i))) // баг 3

  const prev = el.querySelector('[data-infinite-prev]')
  const next = el.querySelector('[data-infinite-next]')
  if (prev) d.listen(prev, 'click', () => engine.shift(-1))
  if (next) d.listen(next, 'click', () => engine.shift(1))
  d.listen(viewport, 'keydown', (event) => {
    if (event.key === 'ArrowLeft') engine.shift(-1)
    if (event.key === 'ArrowRight') engine.shift(1)
  })

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(measure)
    ro.observe(viewport)
    d.add(() => ro.disconnect())
  }
  measure()
  updateLabels()
  el.classList.add('is-ready')
  d.add(() => el.classList.remove('is-ready', 'is-dragging'))

  return {
    engine,
    next: () => engine.shift(1),
    prev: () => engine.shift(-1),
    goTo: (i) => engine.goTo(i),
    get index() {
      return engine.targetIndex
    },
    destroy: d.dispose,
  }
}
