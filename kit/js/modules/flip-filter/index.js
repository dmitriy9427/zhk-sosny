/**
 * Фильтр карточек по категориям с анимацией Flip (портфолио, каталог, блог).
 *
 * ─── Что видит пользователь ───────────────────────────────────────────────
 * Кнопки «Все / Сайты / Лендинги / …» и сетка карточек. Нажали «Сайты» —
 * лишние карточки уменьшаются и тают, оставшиеся ПЛАВНО переезжают на новые
 * места в сетке, а сама сетка становится ниже.
 *
 * ─── Почему без Flip это сложно ─────────────────────────────────────────────
 * Скрыть элемент — значит `display: none`. Сетка мгновенно перестраивается,
 * и все карточки «прыгают» на новые места. Анимировать `display` нельзя, а
 * считать новые позиции каждой карточки вручную — долго и хрупко.
 *
 * ─── Как работает Flip (First → Last → Invert → Play) ───────────────────────
 *   const state = Flip.getState(items)   // First: запомнить, где все сейчас
 *   item.classList.toggle('is-hidden')   // Last: мгновенно показать/скрыть
 *   Flip.from(state, { … })              // Invert+Play: из старых позиций в новые
 *
 * - `absolute: true` — на время анимации карточки вынимаются из сетки
 *   (position: absolute), иначе исчезающие карточки мешали бы раскладке;
 * - `onEnter` — что делать с карточками, которые ПОЯВИЛИСЬ (были скрыты);
 * - `onLeave` — что делать с теми, что ИСЧЕЗАЮТ;
 * - `nested`/`scale` — по умолчанию Flip анимирует transform (быстро).
 *
 * После анимации высота сетки изменилась — значит, сдвинулось всё, что
 * ниже, и ScrollTrigger надо пересчитать (`ScrollTrigger.refresh()`).
 *
 * ─── Почему страница не прыгает ─────────────────────────────────────────────
 * Без защиты при каждом клике по табу страница «скакала». Две причины:
 * 1. `absolute: true` на время анимации вынимает ВСЕ карточки из сетки —
 *    сетка схлопывается до нуля, страница резко становится короче.
 *    → Фиксируем высоту сетки на старте и плавно анимируем её к новой.
 * 2. Если сетка стала ниже, а вы прокрутили близко к концу страницы, браузер
 *    «подтягивает» прокрутку (нельзя быть ниже конца страницы).
 *    → Оставляем сетке min-height ровно такой, чтобы страница не стала
 *    короче уже прокрученного (keepRoomFor). Лишнее место исчезнет при
 *    следующем фильтре или прокрутке вверх.
 * И в конце, если табы всё же сдвинулись на экране, — подкручиваем прокрутку,
 * чтобы они остались ровно там, где были в момент клика.
 *
 * ─── Разметка ────────────────────────────────────────────────────────────────
 *   <section data-module="flip-filter">
 *     <div class="flip-filter__tabs">
 *       <button data-filter="all" aria-pressed="true">Все</button>
 *       <button data-filter="site">Сайты</button>
 *     </div>
 *     <div class="flip-filter__grid">
 *       <article data-flip-item data-category="site landing">…</article>   ← несколько категорий через пробел
 *     </div>
 *   </section>
 * Выбранный фильтр пишется в адрес (?filter=site) — ссылкой можно поделиться.
 * @module kit/modules/flip-filter
 */
import { gsap, ScrollTrigger } from '../../core/gsap.js'
import { Flip } from 'gsap/Flip'
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { getParam, setParam } from '../../core/url.js'

gsap.registerPlugin(Flip)

const DEFAULTS = {
  /** Параметр адреса для выбранного фильтра ('' — не писать в адрес). */
  param: 'filter',
}

/** Подходит ли карточка под фильтр ('all' — любая). Категорий у карточки может быть несколько через пробел. */
export const matchesFilter = (category = '', filter) => filter === 'all' || category.split(/\s+/).includes(filter)

/**
 * Минимальная высота сетки, при которой страница не станет короче уже
 * прокрученного: сетка может уменьшиться не больше чем на «запас прокрутки
 * ниже текущего места».
 * @param {number} startHeight Высота сетки до фильтра.
 * @param {number} endHeight Высота после фильтра (по содержимому).
 * @param {number} maxScroll Предел прокрутки страницы ДО фильтра.
 * @param {number} scroll Текущая прокрутка.
 */
export const keepRoomFor = (startHeight, endHeight, maxScroll, scroll) =>
  Math.max(endHeight, startHeight - Math.max(0, maxScroll - scroll))

export default function flipFilter(el, ctx = {}) {
  const options = readOptions(el, 'flip-filter', DEFAULTS, ctx.options)
  const d = createDisposer()
  const buttons = Array.from(el.querySelectorAll('[data-filter]'))
  const items = Array.from(el.querySelectorAll('[data-flip-item]'))
  const grid = items[0]?.parentElement
  const tabs = buttons[0]?.parentElement
  let current = 'all'
  let flip = null

  if (!buttons.length || !items.length)
    throw new Error('[kit] flip-filter: нужны кнопки [data-filter] и карточки [data-flip-item]')

  /** Применить фильтр с анимацией. */
  function apply(filter) {
    if (filter === current) return
    current = filter
    if (options.param) setParam(options.param, filter === 'all' ? null : filter)

    // Кнопки: подсветка выбранной (и aria-pressed для скринридеров).
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)))

    // Где табы на экране сейчас — сюда же вернём их после анимации.
    const anchorTop = tabs.getBoundingClientRect().top
    const maxScroll = ScrollTrigger.maxScroll(window)
    const scroll = window.scrollY

    // Сбросить запас от прошлого фильтра, чтобы измерить честную высоту.
    grid.style.minHeight = ''

    const startHeight = grid.offsetHeight

    // 1. First — запоминаем положение всех карточек, в том числе скрытых.
    const state = Flip.getState(items)

    // 2. Last — мгновенно показываем/скрываем.
    items.forEach((item) => item.classList.toggle('is-hidden', !matchesFilter(item.dataset.category, filter)))

    const endHeight = keepRoomFor(startHeight, grid.offsetHeight, maxScroll, scroll)
    const duration = ctx.reduced ? 0 : 0.7

    // Высота сетки — плавно от старой к новой (иначе на время анимации сетка
    // схлопнулась бы: absolute: true вынимает карточки из потока).
    gsap.killTweensOf(grid)
    gsap.fromTo(
      grid,
      { height: startHeight },
      {
        height: endHeight,
        duration,
        ease: 'power3.inOut',
        onComplete: () => {
          gsap.set(grid, { clearProps: 'height' })
          grid.style.minHeight = `${endHeight}px` // запас, чтобы страница не «подтянулась»
          // Высота изменилась — пересчитать позиции ScrollTrigger ниже.
          ScrollTrigger.refresh()
          keepTabsAt(anchorTop)
        },
      },
    )

    // 3-4. Invert + Play.
    flip?.kill()
    flip = Flip.from(state, {
      duration,
      ease: 'power3.inOut',
      absolute: true,
      // Появившиеся: из маленьких и прозрачных в нормальные.
      onEnter: (elements) =>
        gsap.fromTo(
          elements,
          { opacity: 0, scale: 0.7 },
          { opacity: 1, scale: 1, duration: ctx.reduced ? 0 : 0.6, delay: 0.1 },
        ),
      // Исчезающие: уменьшаются и тают (Flip сам спрячет их после анимации).
      onLeave: (elements) => gsap.to(elements, { opacity: 0, scale: 0.7, duration: ctx.reduced ? 0 : 0.5 }),
    })
  }

  /** Вернуть табы на прежнее место на экране (если что-то сдвинуло страницу). */
  function keepTabsAt(anchorTop) {
    const delta = tabs.getBoundingClientRect().top - anchorTop

    if (Math.abs(delta) < 1) return
    // С плавным скроллом двигаем через Lenis, иначе он «откатит» прокрутку обратно.
    if (ctx.scroll?.lenis) ctx.scroll.lenis.scrollTo(window.scrollY + delta, { immediate: true })
    else window.scrollBy(0, delta)
  }

  buttons.forEach((button) => {
    if (button.tagName === 'BUTTON') button.type = 'button'
    button.setAttribute('aria-pressed', String(button.dataset.filter === current))
    d.listen(button, 'click', () => apply(button.dataset.filter))
  })

  // Фильтр из адреса — сразу, без анимации.
  const initial = options.param && getParam(options.param)
  if (initial && buttons.some((b) => b.dataset.filter === initial)) {
    current = initial
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === initial)))
    items.forEach((item) => item.classList.toggle('is-hidden', !matchesFilter(item.dataset.category, initial)))
  }
  d.add(() => flip?.kill())
  d.add(() => items.forEach((item) => item.classList.remove('is-hidden')))
  d.add(() => {
    gsap.killTweensOf(grid)
    gsap.set(grid, { clearProps: 'height,minHeight' })
  })

  return {
    apply,
    get filter() {
      return current
    },
    destroy: d.dispose,
  }
}
