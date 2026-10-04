/**
 * Бесконечная галерея: сетка фото без краёв, которую тянут в любую сторону.
 *
 *   <section class="gallery" data-module="infinite-gallery" style="--gallery-columns: 6">
 *     <div class="gallery__pin" data-gallery-pin>
 *       <div class="gallery__viewport" data-gallery-viewport tabindex="0">
 *         <div class="gallery__grid" data-gallery-grid>
 *           <figure class="gallery__item" data-gallery-item tabindex="0">
 *             <img src="…" alt="…" data-lightbox-title="Подпись" data-lightbox-meta="2025">
 *           </figure>
 *           … (число ячеек КРАТНО числу колонок, иначе будут дыры — в консоли подсказка)
 *         </div>
 *       </div>
 *     </div>
 *   </section>
 *
 * ─── Что видит пользователь ───────────────────────────────────────────────
 * Сетку можно тянуть мышью/пальцем, крутить горизонтальным колесом, листать
 * стрелками. Пока секция закреплена (pin), прокрутка страницы двигает сетку.
 * В покое сетка медленно дрейфует. Колонки едут с разной скоростью (глубина),
 * на быстром движении карточки сжимаются и наклоняются. Клик — фото на весь
 * экран (модуль lightbox).
 *
 * ─── Как устроено ───────────────────────────────────────────────────────────
 * 1. Обычная CSS-сетка больше окна (--gallery-grid-width: 170vw).
 * 2. «Цель» (tx, ty) и «текущее» (cx, cy): жесты/колесо/скролл меняют цель,
 *    текущее догоняет её каждый кадр — отсюда инерция.
 * 3. Каждая ячейка сдвигается и «заворачивается» по модулю размера сетки
 *    (grid.js → wrapCell): ушла за край — появилась с другой стороны.
 * 4. Чем больше отставание текущего от цели (скорость), тем сильнее эффекты.
 * Двигаются настоящие DOM-элементы (transform) — работают клики, фокус, подписи.
 * Кадры считаются только пока секция видна и сетка движется.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Дыры в сетке — неполный последний ряд. Предупреждение в консоли.
 * 2. Клик после перетаскивания открывал фото — гасится в фазе захвата.
 * 3. Браузер «перетаскивал картинку» призрачной копией — dragstart запрещён.
 * 4. Вертикальное колесо «застревало» в галерее — слушаем только горизонтальное.
 * 5. Сетка уезжала из-под мыши, пока человек рассматривал фото, — дрейф на паузе
 *    при наведении.
 * 6. Рывок при входе в закреплённый участок — отсчёт скролла сбрасывается.
 * @module kit/modules/infinite-gallery
 */
import { gsap, ScrollTrigger } from '../../core/gsap.js'
import { Observer } from 'gsap/Observer'
import { createDisposer, onViewport } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { centerOn, columnSpeed, squeezeScale, velocityUnit, wrapCell } from './grid.js'
import { createLightbox } from '../lightbox/index.js'

gsap.registerPlugin(Observer)

/**
 * Настройки по умолчанию — data-infinite-gallery-<настройка> или ctx.options.
 */
const DEFAULTS = {
  /** Задержка догоняния, секунды: за это время сетка проходит ~63% пути до цели. 0 — без инерции. */
  lag: 0.22,
  /** Сколько px сетки на 1 px движения мыши/пальца. Больше — сетка «легче». */
  dragSpeed: 2,
  /** Разница скоростей соседних колонок по вертикали: 0 — все едут вместе. */
  columnStep: 0.08,
  /** Сколько px сетки на 1 px прокрутки страницы (пока секция закреплена). */
  scrollFollow: 1.1,
  /** Дрейф в покое, px/с по осям [x, y]. [0, 0] — стоит на месте. */
  drift: [-18, -10],
  /** Максимальный наклон карточек на скорости, градусы. 0 — без наклона. */
  tilt: 10,
  /** Закреплять секцию на экране, пока прокрутка двигает сетку. */
  pin: true,
  /** На сколько прокрутки секция закреплена. */
  pinLength: '+=120%',
  /** Открывать фото на весь экран по клику. */
  lightbox: true,
}

export default function infiniteGallery(el, ctx = {}) {
  const OPTIONS = readOptions(el, 'infinite-gallery', DEFAULTS, ctx.options)
  const d = createDisposer()
  const viewport = el.querySelector('[data-gallery-viewport]')
  const grid = el.querySelector('[data-gallery-grid]')
  const items = Array.from(el.querySelectorAll('[data-gallery-item]'))

  // Нет разметки — нечего оживлять. Возвращаем «пустой» экземпляр, чтобы
  // вызывающий код мог без проверок вызвать destroy().
  if (!viewport || !grid || !items.length) {
    throw new Error('[kit] infinite-gallery: нужны [data-gallery-viewport], [data-gallery-grid] и [data-gallery-item]')
  }

  const reduced = Boolean(ctx.reduced)
  // При «уменьшить движение» — без инерции: сетка просто едет за рукой.
  const lag = reduced ? 0 : OPTIONS.lag

  let columns = 1
  let gridWidth = 1
  let gridHeight = 1
  /** Ячейки с их исходными позициями в сетке (меряются один раз и при ресайзе). */
  let cells = []
  // tx/ty — цель (куда хотим), cx/cy — текущее положение (где сейчас).
  let tx = 0
  let ty = 0
  let cx = 0
  let cy = 0
  let inView = false
  let pointerInside = false
  let dragging = false
  /** Было ли перетаскивание после нажатия — тогда отпускание не считается кликом. */
  let moved = false
  /** Открыт лайтбокс — сетка замирает и не реагирует на жесты. */
  let paused = false

  /**
   * Измерить сетку и ячейки. `offsetLeft/Top` — позиция в сетке БЕЗ учёта
   * нашего transform, поэтому меряем один раз, а сдвиг считаем от неё.
   */
  const measure = () => {
    // Число колонок берём из CSS-переменной: на телефоне оно другое (медиазапрос).
    columns = Math.max(1, Math.round(Number(getComputedStyle(el).getPropertyValue('--gallery-columns')) || 6))
    // Неполный последний ряд = дыры при завороте сетки. Подсказка разработчику:
    // поправьте data-count у сетки (index.html), чтобы он делился на число колонок.
    if (items.length % columns !== 0) {
      console.warn(
        `[kit] infinite-gallery: ${items.length} ячеек не делится на ${columns} колонок — в сетке будут дыры`,
      )
    }
    gridWidth = Math.max(grid.offsetWidth, 1)
    gridHeight = Math.max(grid.offsetHeight, 1)
    cells = items.map((item, index) => ({
      el: item,
      left: item.offsetLeft,
      top: item.offsetTop,
      width: item.offsetWidth,
      height: item.offsetHeight,
      speed: reduced ? 1 : columnSpeed(index, columns, OPTIONS.columnStep),
      x: item.offsetLeft,
      y: item.offsetTop,
    }))
  }

  /** Расставить ячейки по текущему положению сетки. Вызывается в кадре. */
  const render = () => {
    // Отставание текущего от цели ≈ скорость движения.
    const lagX = tx - cx
    const lagY = ty - cy
    const scale = reduced ? 1 : squeezeScale(Math.max(Math.abs(lagX), Math.abs(lagY)))
    // Наклон «навстречу движению»: тянем вниз — нижний край уходит от зрителя.
    const rx = reduced ? 0 : -velocityUnit(lagY) * OPTIONS.tilt
    const ry = reduced ? 0 : velocityUnit(lagX) * OPTIONS.tilt
    const tilt = rx || ry ? ` perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)` : ''

    cells.forEach((cell) => {
      // Позиция с заворотом по модулю: ушла за край — появилась с другой стороны.
      cell.x = wrapCell(cell.left, cx, cell.width, gridWidth)
      cell.y = wrapCell(cell.top, cy * cell.speed, cell.height, gridHeight)
      // Пишем transform строкой, а не через gsap.set: в кадре это заметно дешевле
      // для 30 элементов. toFixed — чтобы не плодить «дрожащие» дробные пиксели.
      cell.el.style.transform = `translate3d(${(cell.x - cell.left).toFixed(1)}px, ${(cell.y - cell.top).toFixed(1)}px, 0)${tilt} scale(${scale.toFixed(4)})`
    })
  }

  /** Можно ли дрейфовать: не мешаем, когда человек что-то делает с сеткой. */
  const canDrift = () =>
    !reduced && !paused && inView && !dragging && !pointerInside && document.visibilityState === 'visible'

  /** Один кадр (вызывается тикером GSAP 60–120 раз в секунду). */
  const tick = (_time, deltaMs) => {
    if (!inView || paused) return

    // dt в секундах; потолок 0.1 с — после свёрнутой вкладки deltaMs бывает огромным.
    const dt = Math.min(deltaMs / 1000, 0.1)

    if (canDrift()) {
      tx += OPTIONS.drift[0] * dt
      ty += OPTIONS.drift[1] * dt
    }

    // Экспоненциальное догоняние (не зависит от FPS): доля пути за этот кадр.
    const k = lag > 0 ? 1 - Math.exp(-dt / lag) : 1

    cx += (tx - cx) * k
    cy += (ty - cy) * k

    // Догнали (меньше 0.1 px) — встаём ровно в цель и, если не дрейфуем,
    // не рисуем кадр вовсе: сетка стоит, работы нет.
    if (Math.abs(tx - cx) < 0.1 && Math.abs(ty - cy) < 0.1) {
      cx = tx
      cy = ty
      if (!canDrift()) return
    }
    render()
  }

  gsap.ticker.add(tick)
  d.add(() => gsap.ticker.remove(tick))
  // Цикл работает, только пока секция рядом с экраном (запас 100 px).
  d.add(onViewport(el, { rootMargin: '100px', enter: () => (inView = true), leave: () => (inView = false) }))

  // --- жесты: Observer объединяет мышь и палец в одно API ---------------------
  const observer = Observer.create({
    target: viewport,
    type: 'pointer,touch',
    // Пока палец сдвинулся меньше чем на 5 px — это ещё не перетаскивание (может быть клик).
    dragMinimum: 5,
    onPress: () => {
      dragging = true
      moved = false
    },
    onDrag: (self) => {
      moved = true
      el.classList.add('is-dragging')
      // self.deltaX/Y — сдвиг с прошлого события. Прибавляем к ЦЕЛИ, плавность сделает tick.
      tx += self.deltaX * OPTIONS.dragSpeed
      ty += self.deltaY * OPTIONS.dragSpeed
    },
    onRelease: () => {
      dragging = false
      el.classList.remove('is-dragging')
    },
  })

  d.add(() => observer.kill())

  // Отпустили после перетаскивания над карточкой — браузер пришлёт click.
  // Гасим его в фазе захвата (третий аргумент true), раньше всех обработчиков.
  d.listen(
    viewport,
    'click',
    (event) => {
      if (!moved) return
      event.preventDefault()
      event.stopPropagation()
    },
    true,
  )
  // Браузер умеет «перетаскивать картинку» сам (призрачная копия) — запрещаем.
  d.listen(viewport, 'dragstart', (event) => event.preventDefault())
  // Мышь над сеткой — дрейф на паузе (неприятно, когда то, что рассматриваешь, уезжает).
  d.listen(viewport, 'pointerenter', (event) => (pointerInside = event.pointerType === 'mouse'))
  d.listen(viewport, 'pointerleave', () => (pointerInside = false))

  // Колесо: только ГОРИЗОНТАЛЬНОЕ (свайп тачпада, Shift+колесо). Вертикальное
  // оставляем странице — иначе посреди страницы колесо «застревало» бы в сетке.
  d.listen(
    viewport,
    'wheel',
    (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      event.preventDefault()
      tx -= event.deltaX
    },
    // passive: false — иначе браузер не даст вызвать preventDefault().
    { passive: false },
  )

  // Стрелки: сдвиг на четверть окна.
  d.listen(viewport, 'keydown', (event) => {
    if (paused) return

    const step = viewport.clientWidth * 0.25
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    const move = moves[event.key]

    if (move) {
      event.preventDefault()
      tx += move[0]
      ty += move[1]
    }
    if (event.key === 'Enter') openItem(event.target.closest?.('[data-gallery-item]'))
  })

  // Фокус с клавиатуры (Tab) на карточку — подвезти её в центр окна.
  // :focus-visible — только клавиатурный фокус: клик мышью тоже даёт фокус,
  // и без этой проверки сетка дёргалась бы в начале каждого перетаскивания.
  d.listen(viewport, 'focusin', (event) => {
    if (!event.target.matches?.(':focus-visible')) return

    const cell = cells.find((c) => c.el === event.target.closest('[data-gallery-item]'))

    if (!cell) return
    const shift = centerOn(cell, viewport.clientWidth, viewport.clientHeight)

    tx += shift.x
    // Колонка едет со своей скоростью — делим, чтобы она приехала точно в центр.
    ty += shift.y / (cell.speed || 1)
  })

  // --- лайтбокс: клик по фото раскрывает его на весь экран -----------------------
  const lightbox = createLightbox({
    reduced,
    onOpen: () => {
      paused = true
      observer.disable()
    },
    onClose: () => {
      paused = false
      observer.enable()
    },
  })

  d.add(() => lightbox.destroy())

  /** Открыть фото карточки в лайтбоксе (подпись — из data-lightbox-* картинки). */
  function openItem(item) {
    const img = item?.querySelector('img')
    if (!img || !OPTIONS.lightbox) return
    lightbox.open(img, {
      title: img.dataset.lightboxTitle ?? img.alt,
      meta: img.dataset.lightboxMeta ?? '',
      credit: img.dataset.lightboxCredit ?? '',
    })
  }

  // Обычный клик (после перетаскивания его погасил обработчик выше).
  d.listen(viewport, 'click', (event) => openItem(event.target.closest('[data-gallery-item]')))

  // --- прокрутка страницы: секция закреплена, сетка едет вслед ----------------
  // ScrollTrigger здесь делает две вещи: закрепляет (pin) секцию на экране
  // на `pinLength` прокрутки и сообщает, на сколько прокрутили.
  let lastScroll = null
  const pin =
    OPTIONS.pin &&
    ScrollTrigger.create({
      trigger: el,
      pin: viewport.closest('[data-gallery-pin]') ?? true,
      start: 'top top',
      end: OPTIONS.pinLength,
      onUpdate: (self) => {
        const scroll = self.scroll()

        // Двигаем на РАЗНИЦУ с прошлым вызовом: прокрутили вниз на 50 px — сетка
        // уехала вверх на 50 × scrollFollow.
        if (lastScroll !== null && !paused) ty -= (scroll - lastScroll) * OPTIONS.scrollFollow
        lastScroll = scroll
      },
      // Вошли/вышли из закреплённого участка — начинаем отсчёт заново, иначе
      // первый же кадр после входа дал бы рывок на всю пройденную дистанцию.
      onToggle: () => (lastScroll = null),
    })

  // kill(true) — снять пин и вернуть разметку как было (без pin-spacer).
  if (pin) d.add(() => pin.kill(true))

  // --- размеры: окно поменяли — перемерить ячейки --------------------------------
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (measure(), render())) : null

  resizeObserver?.observe(grid)
  d.add(() => resizeObserver?.disconnect())
  measure()
  render()
  // Класс включает в CSS режим «сетку двигает JS» (без него — обычная прокрутка блока).
  el.classList.add('is-active')
  d.add(() => {
    el.classList.remove('is-active', 'is-dragging')
    items.forEach((item) => item.style.removeProperty('transform'))
  })

  return {
    /** Сдвинуть сетку на x/y пикселей (с инерцией). Удобно для своих кнопок. */
    moveBy(x, y) {
      tx += x
      ty += y
    },
    /** Открыть фото карточки (номер ячейки) в лайтбоксе. */
    open(index) {
      openItem(items[index])
    },
    lightbox,
    destroy: d.dispose,
  }
}
