/**
 * Карточки «стопкой» при прокрутке: каждая следующая наезжает на предыдущую,
 * а та уменьшается и темнеет (секции «Этапы работы», «Преимущества», кейсы).
 *
 *   <div class="stack-cards" data-module="stack-cards">
 *     <article class="stack-cards__item" data-stack-card>…</article>
 *     <article class="stack-cards__item" data-stack-card>…</article>
 *   </div>
 *
 * ─── Почему sticky + scrub, а не pin ────────────────────────────────────────
 * Карточки «прилипают» через CSS position: sticky (стили — _effects.scss),
 * GSAP только масштабирует уходящую карточку по прогрессу скролла. Это
 * дешевле пинов (нет pin-spacer, нет пересчётов высоты), работает с Lenis и
 * не ломается при ресайзе.
 *
 * Баг, закрытый здесь: sticky не работает, если у предка overflow: hidden —
 * в консоли будет предупреждение с этим предком.
 *
 * ─── Карточка выше экрана и центрирование ─────────────────────────────────
 * Липкая карточка, которая выше видимой области, никогда не покажет свой низ:
 * она прилипла верхом, а следующая наезжает раньше, чем вы докрутите до кнопок.
 * На телефоне так «пропадали» ссылки в карточках проектов. Поэтому модуль
 * меряет каждую карточку (stackTop) и:
 *   - помещается — ставит её по центру видимой области под шапкой
 *     (--stack-top): ссылки не прячутся под нижнюю панель браузера;
 *   - не помещается — снимает липкость (класс is-tall): карточка
 *     прокручивается как обычный блок, видно всё содержимое.
 * Пересчёт — при изменении размеров карточек и окна (ResizeObserver).
 *
 * ─── Почему затемнение — отдельный слой, а не CSS-переменная ────────────────
 * Раньше JS каждый кадр прокрутки менял у карточки --stack-dim, а её читал
 * ::after. Но CSS-переменная наследуется: её изменение заставляет браузер
 * пересчитать стили ВСЕГО содержимого карточки (текст, чипы, галерея) — на
 * телефоне с десятком карточек прокрутка «фризила». Теперь модуль добавляет в
 * карточку слой .stack-cards__shade и анимирует его opacity, а у карточки —
 * только transform. Оба свойства браузер считает на видеокарте (компоновка),
 * без пересчёта стилей и перерисовки.
 * @module kit/modules/stack-cards
 */
import { gsap } from '../../core/gsap.js'
import { readOptions } from '../../core/options.js'
import { createDisposer } from '../../core/lifecycle.js'

const DEFAULTS = {
  /** Насколько уменьшается уходящая карточка (0.1 = на 10%). */
  scale: 0.08,
  /** Затемнение уходящей карточки (0–1). */
  dim: 0.35,
  /** Шаг «корешков» стопки: каждая следующая карточка липнет ниже на столько px. */
  step: 12,
  /** Минимальный отступ от шапки и от низа экрана, px. */
  gap: 16,
}

/**
 * Где прилипнуть карточке (px от верха окна) или null, если она не помещается.
 * Карточка встаёт по центру свободного места под шапкой; «корешок» стопки
 * (offset) сдвигает её ниже, но не дальше, чем позволяет запас снизу — иначе
 * при десятке карточек сдвиг съел бы весь экран и они перестали бы липнуть.
 * @param {number} height Высота карточки.
 * @param {number} viewport Высота окна.
 * @param {number} header Высота фиксированной шапки.
 * @param {number} offset Желаемый сдвиг этой карточки в стопке (index × step).
 * @param {number} gap Минимальный отступ сверху и снизу.
 */
export function stackTop(height, viewport, header, offset, gap) {
  const slack = viewport - header - height - gap * 2
  if (slack < 0) return null
  return Math.round(header + gap + slack / 2 + Math.min(offset, slack / 2))
}

/** Высота шапки из CSS-переменной --header-height (может быть в rem). */
function headerHeight() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--header-height, 0px)'
  document.body.append(probe)
  const h = probe.offsetHeight
  probe.remove()
  return h
}

/** Найти предка с overflow, который ломает position: sticky. */
export function stickyBlocker(el) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflow, overflowY } = getComputedStyle(node)
    if (/(hidden|auto|scroll)/.test(`${overflow} ${overflowY}`)) return node
  }
  return null
}

export default function stackCards(root, ctx = {}) {
  const options = readOptions(root, 'stack-cards', DEFAULTS, ctx.options)
  const cards = Array.from(root.querySelectorAll('[data-stack-card]'))
  if (cards.length < 2) return undefined
  const blocker = stickyBlocker(root)
  if (blocker) console.warn('[kit] stack-cards: position: sticky не сработает — у предка overflow', blocker)
  const d = createDisposer()
  cards.forEach((card, i) => card.style.setProperty('--stack-index', i))
  // Слой затемнения в каждой карточке, кроме последней (её никто не накрывает).
  const shades = cards.slice(0, -1).map((card) => {
    const shade = document.createElement('span')
    shade.className = 'stack-cards__shade'
    shade.setAttribute('aria-hidden', 'true')
    card.append(shade)
    return shade
  })
  d.add(() => shades.forEach((shade) => shade.remove()))

  function layout() {
    const header = headerHeight()
    cards.forEach((card, i) => {
      const top = stackTop(card.offsetHeight, window.innerHeight, header, i * options.step, options.gap)
      card.classList.toggle('is-tall', top === null)
      if (top === null) card.style.removeProperty('--stack-top')
      else card.style.setProperty('--stack-top', `${top}px`)
    })
  }
  layout()
  // Картинки догрузились, шрифт сменился, повернули телефон — пересчитать.
  const observer = new ResizeObserver(() => layout())
  cards.forEach((card) => observer.observe(card))
  d.add(() => observer.disconnect())
  d.listen(window, 'resize', layout)
  d.add(() =>
    cards.forEach((card) => {
      card.classList.remove('is-tall')
      card.style.removeProperty('--stack-top')
    }),
  )
  if (ctx.reduced) return { layout, destroy: d.dispose }

  const g = gsap.context(() => {
    cards.slice(0, -1).forEach((card, i) => {
      const next = cards[i + 1]
      // Не липнущая (высокая) карточка не уходит «под» следующую — не уменьшаем её.
      const stuck = () => !card.classList.contains('is-tall')
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true },
        })
        .to(card, { scale: () => (stuck() ? 1 - options.scale : 1) }, 0)
        .to(shades[i], { opacity: () => (stuck() ? options.dim : 0) }, 0)
    })
  }, root)
  d.add(() => g.revert())

  return { layout, destroy: d.dispose }
}
