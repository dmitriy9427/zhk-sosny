/**
 * Плавный скролл (Lenis) + якорные ссылки с учётом фиксированной шапки.
 *
 * ─── Почему Lenis, а не ScrollSmoother ─────────────────────────────────────
 * Lenis двигает НАСТОЯЩИЙ скролл окна — не нужна обёртка #smooth-wrapper,
 * работает position: sticky, работают нативные якоря и браузерный поиск
 * по странице. Для фриланс-вёрстки это меньше сюрпризов.
 *
 * ─── Когда плавный скролл выключается ─────────────────────────────────────
 * - пользователь просил меньше анимаций (prefers-reduced-motion);
 * - тач-устройство: родная инерция пальца лучше любой эмуляции, а Lenis
 *   на iOS ломает «резинку» и жест «назад».
 * В этих случаях работает обычный скролл, а якоря — через scrollIntoView
 * и CSS scroll-margin-top (см. base/_root.scss).
 *
 * ─── Связка с ScrollTrigger ──────────────────────────────────────────────────
 * Lenis должен обновляться в ТОМ ЖЕ кадре, что и GSAP, иначе анимации
 * на скролле дрожат. Поэтому крутим Lenis от gsap.ticker и сообщаем
 * ScrollTrigger о каждом сдвиге.
 *
 * ─── Вложенная прокрутка ────────────────────────────────────────────────────
 * Без этого Lenis перехватывает колесо/тачпад ВЕЗДЕ: внутри модалки, длинного
 * выпадающего списка, таблицы с overflow: auto крутится страница, а не блок.
 * Защита в три слоя:
 *   1. allowNestedScroll: true — Lenis сам проверяет, может ли блок под
 *      курсором прокрутиться в эту сторону (overflow: auto/scroll и есть куда),
 *      и тогда отдаёт событие браузеру. Покрывает таблицы, код, свои блоки —
 *      без атрибутов. Когда блок докручен до конца, колесо снова крутит страницу.
 *   2. NESTED_SCROLL — элементы кита, которым плавный скролл не нужен никогда
 *      (модалка, меню, выпадающий список, textarea…), даже если в момент
 *      события прокручивать им нечего: так страница не «проезжает» под окном.
 *   3. data-lenis-prevent — вручную на любом блоке (и -vertical, -horizontal,
 *      -wheel, -touch — только для одного типа событий), а для проекта —
 *      опция prevent: createApp({ smooth: { prevent: (node) => … } }).
 * Пока страница заблокирована (модалка, меню — lockScroll → lenis.stop()),
 * Lenis гасит колесо, НО проверки выше идут раньше — блоки внутри окна
 * прокручиваются нормально.
 * @module kit/core/smooth-scroll
 */
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './gsap.js'
import { delegate } from './dom.js'

/**
 * Блоки кита со своей прокруткой. Расширяйте через опцию prevent, а не правкой списка.
 * dialog и [popover] — верхний слой браузера: страница под ними не должна ехать.
 */
export const NESTED_SCROLL = [
  '[data-lenis-prevent]',
  'dialog',
  '[popover]',
  '.mobile-menu',
  '.select__dropdown',
  '.select__scroller',
  '.scroll-area',
  '[data-overlayscrollbars-viewport]', // модуль scrollbar
  'textarea',
  'iframe',
].join(', ')

/** Высота фиксированной шапки из CSS-переменной --header-height (для якорей). */
export function headerOffset() {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height'))
  return Number.isFinite(value) ? value : 0
}

/**
 * @param {{ enabled?: boolean, duration?: number, anchors?: boolean, reduced?: boolean, prevent?: (node: HTMLElement) => boolean }} [o]
 *   enabled — включить Lenis (иначе нативный скролл, но API тот же);
 *   anchors — перехватывать клики по ссылкам вида #id;
 *   prevent — свои блоки, где колесо должно работать нативно (в дополнение к NESTED_SCROLL).
 */
export function createSmoothScroll({ enabled = true, duration = 1.1, anchors = true, reduced = false, prevent } = {}) {
  let lenis = null
  let tick = null

  if (enabled) {
    lenis = new Lenis({
      duration,
      autoRaf: false,
      allowNestedScroll: true,
      prevent: (node) => node.matches(NESTED_SCROLL) || Boolean(prevent?.(node)),
    })
    lenis.on('scroll', ScrollTrigger.update)
    tick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    // Без этого после долгого кадра (вкладка была в фоне) GSAP «догоняет»
    // время рывком, и Lenis прыгает.
    gsap.ticker.lagSmoothing(0)
  }

  /**
   * Прокрутить к элементу/селектору/числу.
   * @param {Element | string | number} target
   * @param {{ offset?: number, immediate?: boolean }} [o]
   */
  function scrollTo(target, { offset = -headerOffset(), immediate = false } = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target
    if (el === null) return
    if (lenis) {
      lenis.scrollTo(el, { offset, immediate: immediate || reduced })
      return
    }
    const top = typeof el === 'number' ? el : el.getBoundingClientRect().top + window.scrollY + offset
    window.scrollTo({ top, behavior: immediate || reduced ? 'auto' : 'smooth' })
  }

  const stopAnchors = anchors
    ? delegate(document, 'click', 'a[href*="#"]', (event, link) => {
        // Только ссылки на ЭТУ страницу; «/about#team» с другой страницы
        // браузер обработает сам.
        const url = new URL(link.href, location.href)
        if (url.pathname !== location.pathname || url.origin !== location.origin || !url.hash) return
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || link.target === '_blank') return

        const id = decodeURIComponent(url.hash.slice(1))
        const target = id === 'top' ? document.body : document.getElementById(id)
        if (!target) return // нет такого id — пусть браузер делает что хочет
        // #id модалки — это не якорь, а «открыть окно»: его обрабатывает модуль dialog.
        if (target.tagName === 'DIALOG') return

        event.preventDefault()
        scrollTo(target === document.body ? 0 : target)
        history.pushState(null, '', url.hash)
        // Доступность: перевести фокус к цели, чтобы Tab продолжился оттуда.
        if (target !== document.body) {
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
          target.focus({ preventScroll: true })
        }
      })
    : () => {}

  return {
    lenis,
    scrollTo,
    stop: () => lenis?.stop(),
    start: () => lenis?.start(),
    destroy() {
      stopAnchors()
      if (tick) gsap.ticker.remove(tick)
      lenis?.destroy()
    },
  }
}
