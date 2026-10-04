/**
 * Swiper — слайдер для всего, чего не умеет простой `slider` на scroll-snap:
 * бесконечная петля, эффекты (fade, карточки, coverflow, 3D), галерея с
 * миниатюрами, автопрокрутка-«лента», вертикальный режим, сетка, зум.
 *
 *   <div class="swiper" data-module="swiper" data-swiper-preset="cards">
 *     <div class="swiper-wrapper">
 *       <div class="swiper-slide">…</div>
 *     </div>
 *     <button class="swiper-button-prev"></button>
 *     <button class="swiper-button-next"></button>
 *     <div class="swiper-pagination"></div>
 *   </div>
 *
 * Настройки (все необязательные):
 *   data-swiper-preset="cards"     готовый набор (см. PRESETS ниже)
 *   data-swiper-options='{"slidesPerView": 3, "spaceBetween": 24}'   любые опции Swiper
 *   data-swiper-breakpoints='{"md": {"slidesPerView": 2}, "lg": {"slidesPerView": 3}}'
 *                                  брейкпоинты по ИМЕНАМ из SCSS — числа не дублируются
 *   data-swiper-controls="#cases-nav"   где искать стрелки/точки, если они вне слайдера
 *   data-swiper-thumbs="#gallery-thumbs" миниатюры (обычная swiper-разметка без data-module)
 * Из JS/React: ctx.options = { preset, options: {...}, breakpoints, controls, thumbs }.
 *
 * ─── Почему отдельный модуль, а не просто new Swiper() ─────────────────────
 * Каждый пункт ниже — баг, на который натыкается почти каждый проект со Swiper:
 * 1. Стрелки/точки в шапке секции, а не внутри .swiper — Swiper их не находит,
 *    а при нескольких слайдерах на странице `.swiper-button-next` из
 *    глобального селектора цепляется к ЧУЖОМУ слайдеру. Модуль ищет элементы
 *    управления внутри слайдера, затем в ближайшей секции, и передаёт Swiper
 *    сами элементы, а не селекторы.
 * 2. Слайдер внутри скрытого блока (таб, аккордеон, модалка) инициализируется
 *    с шириной 0 и «ломается». Включены observer/observeParents + пересчёт
 *    при появлении на экране.
 * 3. loop при малом числе слайдов в Swiper 11+ даёт дыры и предупреждения —
 *    модуль сам переключается на rewind и пишет, сколько слайдов нужно.
 * 4. Автопрокрутка крутится в невидимом слайдере и при «меньше движения» —
 *    пауза вне экрана, выключение при prefers-reduced-motion.
 * 5. Тексты для скринридера по-английски — подписи из словарей кита (ru/en).
 * 6. Слайдов меньше, чем помещается, — стрелки бесполезны: watchOverflow
 *    прячет их (класс swiper-button-lock).
 * 7. Брейкпоинты в px дублируют SCSS и расходятся — здесь имена md/lg.
 * Код Swiper (~40 КБ) грузится только на страницах со слайдером.
 * @module kit/modules/swiper
 */
import Swiper from 'swiper'
import {
  A11y,
  Autoplay,
  EffectCards,
  EffectCoverflow,
  EffectCreative,
  EffectFade,
  FreeMode,
  Grid,
  Keyboard,
  Mousewheel,
  Navigation,
  Pagination,
  Parallax,
  Scrollbar,
  Thumbs,
  Zoom,
} from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/a11y'
import 'swiper/css/effect-cards'
import 'swiper/css/effect-coverflow'
import 'swiper/css/effect-creative'
import 'swiper/css/effect-fade'
import 'swiper/css/free-mode'
import 'swiper/css/grid'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import 'swiper/css/scrollbar'
import 'swiper/css/thumbs'
import 'swiper/css/zoom'
import { createDisposer, onViewport } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { getBreakpoints } from '../../core/env.js'
import { t } from '../../core/i18n.js'

const MODULES = [
  A11y,
  Autoplay,
  EffectCards,
  EffectCoverflow,
  EffectCreative,
  EffectFade,
  FreeMode,
  Grid,
  Keyboard,
  Mousewheel,
  Navigation,
  Pagination,
  Parallax,
  Scrollbar,
  Thumbs,
  Zoom,
]

/**
 * Готовые наборы. Опции из data-swiper-options дополняют/перекрывают пресет.
 * Свой пресет проекта: import { PRESETS } … PRESETS.myCase = {…} (до запуска).
 */
export const PRESETS = {
  /** Лента карточек: 1.2 на мобилке, 2 на планшете, 3 на десктопе. */
  default: {
    slidesPerView: 1.15,
    spaceBetween: 16,
    breakpoints: { md: { slidesPerView: 2, spaceBetween: 24 }, lg: { slidesPerView: 3, spaceBetween: 32 } },
  },
  /** Полноэкранный баннер: плавная смена кадров, петля, автопрокрутка. */
  fade: { effect: 'fade', fadeEffect: { crossFade: true }, loop: true, speed: 800, autoplay: { delay: 5000 } },
  /** Стопка карточек, которые смахиваются. */
  cards: { effect: 'cards', grabCursor: true, cardsEffect: { perSlideOffset: 8, perSlideRotate: 2 } },
  /** Центральный слайд крупно, соседние повёрнуты в 3D. */
  coverflow: {
    effect: 'coverflow',
    centeredSlides: true,
    slidesPerView: 'auto',
    loop: true,
    grabCursor: true,
    coverflowEffect: { rotate: 30, stretch: 0, depth: 120, modifier: 1, slideShadows: false },
  },
  /** Кадры «наезжают» друг на друга с масштабом. */
  creative: {
    effect: 'creative',
    grabCursor: true,
    creativeEffect: {
      prev: { shadow: true, translate: ['-20%', 0, -1], scale: 0.9 },
      next: { translate: ['100%', 0, 0] },
    },
  },
  /** Центрированная петля: активный слайд по центру. */
  center: {
    centeredSlides: true,
    slidesPerView: 1.3,
    spaceBetween: 16,
    loop: true,
    breakpoints: { lg: { slidesPerView: 2.4 } },
  },
  /** Бегущая лента логотипов: непрерывное движение без остановок. */
  marquee: {
    slidesPerView: 'auto',
    spaceBetween: 48,
    loop: true,
    speed: 5000,
    allowTouchMove: false,
    autoplay: { delay: 0, disableOnInteraction: false, pauseOnMouseEnter: true },
    cssClass: 'swiper--marquee',
  },
  /** Вертикальная прокрутка колесом (истории, отзывы). */
  vertical: { direction: 'vertical', slidesPerView: 1, mousewheel: { forceToAxis: true, releaseOnEdges: true } },
  /** Свободная прокрутка без «прилипания» к слайдам. */
  free: { slidesPerView: 'auto', spaceBetween: 16, freeMode: { enabled: true, sticky: false } },
  /** Сетка 2 ряда (каталог, логотипы). */
  grid: {
    slidesPerView: 2,
    grid: { rows: 2, fill: 'row' },
    spaceBetween: 16,
    breakpoints: { lg: { slidesPerView: 4 } },
  },
}

const DEFAULTS = {
  preset: 'default',
  /** JSON с любыми опциями Swiper. */
  options: {},
  /** JSON брейкпоинтов по именам: {"md": {...}}. */
  breakpoints: {},
  /** Селектор контейнера со стрелками/точками, если они вне слайдера. */
  controls: '',
  /** Селектор слайдера-миниатюр (галерея). */
  thumbs: '',
}

/** Брейкпоинты по именам ('md') → по пикселям (768), как ждёт Swiper. */
export function resolveBreakpoints(map = {}, names = getBreakpoints()) {
  const out = {}
  for (const [key, value] of Object.entries(map)) {
    const px = Number.isFinite(Number(key)) ? Number(key) : names[key]
    if (px === undefined) {
      console.warn(`[kit] swiper: нет брейкпоинта «${key}». Есть: ${Object.keys(names).join(', ')}`)
      continue
    }
    out[px] = value
  }
  return out
}

/**
 * Сколько слайдов нужно для петли (Swiper 11+): видимые + запас.
 * @param {{ slidesPerView?: number | 'auto', slidesPerGroup?: number, centeredSlides?: boolean, grid?: { rows?: number } }} [config]
 */
export function loopMinimum({ slidesPerView = 1, slidesPerGroup = 1, centeredSlides = false, grid } = {}) {
  if (grid?.rows > 1) return Infinity // петля и сетка в Swiper несовместимы
  const perView = slidesPerView === 'auto' ? 1 : Math.ceil(slidesPerView)
  return perView + slidesPerGroup + (centeredSlides ? 1 : 0)
}

/** Склеить пресет и свои опции (вложенные объекты — глубоко). */
export function mergeOptions(base, extra) {
  const out = { ...base }
  for (const [key, value] of Object.entries(extra ?? {})) {
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && typeof base[key] === 'object'
        ? mergeOptions(base[key], value)
        : value
  }
  return out
}

/** Найти элемент управления: внутри слайдера → в контейнере controls → в ближайшей секции. */
function findControl(root, scopes, selector) {
  for (const scope of scopes) {
    const found = scope?.querySelector(selector)
    // Не берём элемент, который принадлежит другому слайдеру внутри секции.
    if (found && (found.closest('.swiper') === root || !found.closest('.swiper'))) return found
  }
  return null
}

/** @param {HTMLElement} root @param {Record<string, any>} [ctx] */
export default function swiperModule(root, ctx = {}) {
  const options = readOptions(root, 'swiper', DEFAULTS, ctx.options)
  const preset = PRESETS[options.preset]
  if (!preset)
    throw new Error(`[kit] swiper: нет пресета «${options.preset}». Есть: ${Object.keys(PRESETS).join(', ')}`)
  const d = createDisposer()

  const { cssClass, ...presetOptions } = preset
  const config = mergeOptions(presetOptions, options.options)
  config.breakpoints = resolveBreakpoints({
    ...(presetOptions.breakpoints ?? {}),
    ...(options.breakpoints ?? {}),
    ...(options.options?.breakpoints ?? {}),
  })
  if (cssClass) root.classList.add(cssClass)

  // ─── Элементы управления (баг 1) ─────────────────────────────────────────
  const scopes = [
    root,
    options.controls ? document.querySelector(options.controls) : null,
    root.closest('section, [data-swiper-scope]'),
  ]
  const prev = findControl(root, scopes, '.swiper-button-prev, [data-swiper-prev]')
  const next = findControl(root, scopes, '.swiper-button-next, [data-swiper-next]')
  const pagination = findControl(root, scopes, '.swiper-pagination, [data-swiper-pagination]')
  const scrollbar = findControl(root, scopes, '.swiper-scrollbar, [data-swiper-scrollbar]')
  ;[prev, next].forEach((button) => button?.tagName === 'BUTTON' && (button.type = 'button'))
  if (prev || next) config.navigation = { prevEl: prev, nextEl: next, ...(config.navigation ?? {}) }
  if (pagination) config.pagination = { el: pagination, clickable: true, ...(config.pagination ?? {}) }
  if (scrollbar) config.scrollbar = { el: scrollbar, draggable: true, ...(config.scrollbar ?? {}) }

  // ─── Петля при малом числе слайдов (баг 3) ────────────────────────────────
  const slidesCount = root.querySelectorAll(':scope > .swiper-wrapper > .swiper-slide').length
  if (config.loop && slidesCount < loopMinimum(config)) {
    console.warn(
      `[kit] swiper: для loop нужно хотя бы ${loopMinimum(config)} слайдов, а их ${slidesCount} — включён rewind`,
    )
    config.loop = false
    config.rewind = true
  }

  // ─── Движение и доступность (баги 4, 5) ──────────────────────────────────
  if (ctx.reduced) {
    config.speed = 0
    config.autoplay = false
  }
  /** @type {HTMLElement | null} */
  const thumbsEl = options.thumbs ? document.querySelector(options.thumbs) : null
  let thumbs = null
  if (thumbsEl) {
    thumbs = new Swiper(thumbsEl, {
      modules: [FreeMode, Thumbs],
      slidesPerView: 'auto',
      spaceBetween: 8,
      freeMode: true,
      watchSlidesProgress: true,
      slideToClickedSlide: true,
    })
    config.thumbs = { swiper: thumbs }
    d.add(() => thumbs.destroy(true, true))
  }

  const swiper = new Swiper(root, {
    modules: MODULES,
    watchOverflow: true, // баг 6
    observer: true, // баг 2
    observeParents: true,
    keyboard: { enabled: true, onlyInViewport: true },
    a11y: {
      prevSlideMessage: t('kit.slider.prev'),
      nextSlideMessage: t('kit.slider.next'),
      firstSlideMessage: t('kit.swiper.first'),
      lastSlideMessage: t('kit.swiper.last'),
      paginationBulletMessage: t('kit.swiper.bullet'),
      slideLabelMessage: t('kit.swiper.slide'),
      containerRoleDescriptionMessage: t('kit.slider.carousel'),
    },
    ...config,
  })
  d.add(() => swiper.destroy(true, true))

  swiper.on('slideChange', () => {
    root.dispatchEvent(new CustomEvent('swiper:change', { bubbles: true, detail: { index: swiper.realIndex, swiper } }))
  })

  // Автопрокрутка — только пока виден (баг 4); при появлении — пересчёт размеров (баг 2).
  d.add(
    onViewport(root, {
      enter: () => {
        swiper.update()
        if (config.autoplay && swiper.autoplay) swiper.autoplay.start()
      },
      leave: () => swiper.autoplay?.running && swiper.autoplay.stop(),
    }),
  )

  return { swiper, thumbs, destroy: d.dispose }
}
