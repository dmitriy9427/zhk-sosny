/**
 * Горизонтальная лента: листаете страницу ВНИЗ — лента едет ВБОК.
 *
 * ─── Что видит пользователь ───────────────────────────────────────────────
 * Секция закрепляется на экране, и обычная прокрутка двигает ряд карточек
 * справа налево. По желанию: линия-«таймлайн» прорисовывается (DrawSVG),
 * полоса прогресса заполняется, фото в карточках «приближается»
 * ([data-hscroll-zoom]), числа расшифровываются ([data-hscroll-scramble]).
 *
 * ─── Как работает ───────────────────────────────────────────────────────────
 * 1. Главный твин: `gsap.to(track, { x: -(ширина ленты − ширина окна) })`
 *    со ScrollTrigger: pin (секция стоит), scrub (прогресс = скролл),
 *    end = на столько px прокрутки, сколько лента должна проехать вбок —
 *    тогда скорость ленты совпадает со скоростью скролла.
 * 2. `containerAnimation` — ключевое понятие. Обычный ScrollTrigger следит
 *    за ВЕРТИКАЛЬНЫМ положением элемента на экране. Но карточки внутри
 *    ленты по вертикали не двигаются — они едут вбок. Передав
 *    `containerAnimation: главныйТвин`, мы говорим ScrollTrigger: «считай
 *    положение карточки внутри горизонтальной анимации». Тогда
 *    `start: 'left 80%'` значит «левый край карточки дошёл до 80% ширины окна».
 * 3. `ease: 'none'` у главного твина ОБЯЗАТЕЛЬНО: иначе связь скролла и
 *    положения карточек нелинейна, и containerAnimation посчитает неверно.
 * 4. Размеры — функциями с `invalidateOnRefresh: true`: при ресайзе окна
 *    длина пути пересчитывается.
 *
 * ─── Разметка ────────────────────────────────────────────────────────────────
 *   <section class="hscroll" data-module="hscroll">
 *     <div class="hscroll__pin" data-hscroll-pin>
 *       <svg><path data-hscroll-line …/></svg>          (по желанию)
 *       <div class="hscroll__progress" data-hscroll-progress></div>  (по желанию)
 *       <div class="hscroll__track" data-hscroll-track>
 *         <article class="hscroll__card" data-hscroll-card>
 *           <img data-hscroll-zoom …>  <span data-hscroll-scramble>1961</span>
 *         </article> …
 *       </div>
 *     </div>
 *   </section>
 *
 * ─── Мобилка ────────────────────────────────────────────────────────────────
 * Работает и на телефоне, но длинная лента на узком экране утомляет. Частое
 * решение — на мобилке обычная прокрутка карточек: data-hscroll-min="md"
 * включает эффект только от брейкпоинта md (ниже — CSS-лента со scroll-snap).
 * @module kit/modules/hscroll
 */
import { gsap } from '../../core/gsap.js'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { upQuery } from '../../core/env.js'

gsap.registerPlugin(DrawSVGPlugin, ScrambleTextPlugin)

const DEFAULTS = {
  /** Брейкпоинт, с которого включается эффект ('' — всегда). */
  min: '',
  /** Плавность следования за скроллом (0 — жёстко, 1 — мягко). */
  scrub: 0.8,
}

/**
 * Сколько px ленте нужно проехать влево, чтобы последняя карточка
 * встала к правому краю окна. Не меньше 0 (лента уже окна — ехать некуда).
 */
export const travelDistance = (trackWidth, viewportWidth) => Math.max(0, trackWidth - viewportWidth)

export default function hscroll(el, ctx = {}) {
  const options = readOptions(el, 'hscroll', DEFAULTS, ctx.options)
  const d = createDisposer()
  const pin = el.querySelector('[data-hscroll-pin]') ?? el
  const track = el.querySelector('[data-hscroll-track]')
  const line = el.querySelector('[data-hscroll-line]')
  const progress = el.querySelector('[data-hscroll-progress]')

  if (!track) throw new Error('[kit] hscroll: нужен [data-hscroll-track]')

  const distance = () => travelDistance(track.scrollWidth, window.innerWidth)

  // matchMedia: эффект живёт только на подходящих экранах; при смене экрана
  // GSAP сам всё убирает и создаёт заново (баг «сломалось после поворота»).
  const mm = gsap.matchMedia(el)
  mm.add(options.min ? upQuery(options.min) : 'all', () => {
    el.classList.add('is-active')
    // 1. Главный твин: лента едет влево на всю «лишнюю» ширину.
    const move = gsap.to(track, {
      x: () => -distance(),
      ease: 'none', // линейно! см. п. 3 в шапке
      scrollTrigger: {
        trigger: el,
        pin,
        start: 'top top',
        end: () => `+=${distance()}`,
        scrub: ctx.reduced ? true : options.scrub,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (progress) progress.style.transform = `scaleX(${self.progress.toFixed(4)})`
        },
      },
    })

    // Линия-таймлайн прорисовывается синхронно с лентой.
    if (line) {
      gsap.fromTo(
        line,
        { drawSVG: '0% 0%' },
        {
          drawSVG: '0% 100%',
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: () => `+=${distance()}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      )
    }

    if (ctx.reduced) return () => el.classList.remove('is-active')

    // 2. Анимации карточек — относительно горизонтального движения (containerAnimation).
    el.querySelectorAll('[data-hscroll-card]').forEach((card) => {
      const photo = card.querySelector('[data-hscroll-zoom]')
      const year = card.querySelector('[data-hscroll-scramble]')

      // Фото «приближается», пока карточка проезжает от правого края до середины.
      if (photo) {
        gsap.fromTo(
          photo,
          { scale: 1.35 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              containerAnimation: move,
              start: 'left right',
              end: 'center center',
              scrub: true,
            },
          },
        )
      }

      // Год расшифровывается один раз, когда карточка въехала на 80% окна.
      if (year) {
        gsap.from(year, {
          duration: 1,
          scrambleText: { text: year.textContent, chars: '0123456789', speed: 0.5 },
          scrollTrigger: {
            trigger: card,
            containerAnimation: move,
            start: 'left 80%',
            toggleActions: 'play none none none',
          },
        })
      }
    })
    return () => el.classList.remove('is-active')
  })

  d.add(() => mm.revert())
  return { destroy: d.dispose }
}
