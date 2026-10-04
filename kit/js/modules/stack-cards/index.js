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
 * @module kit/modules/stack-cards
 */
import { gsap } from '../../core/gsap.js'
import { readOptions } from '../../core/options.js'

const DEFAULTS = {
  /** Насколько уменьшается уходящая карточка (0.1 = на 10%). */
  scale: 0.08,
  /** Затемнение уходящей карточки (0–1). */
  dim: 0.35,
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
  cards.forEach((card, i) => card.style.setProperty('--stack-index', i))
  if (ctx.reduced) return undefined

  const g = gsap.context(() => {
    cards.slice(0, -1).forEach((card, i) => {
      const next = cards[i + 1]
      gsap.to(card, {
        scale: 1 - options.scale,
        '--stack-dim': options.dim,
        ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true },
      })
    })
  }, root)

  return { destroy: () => g.revert() }
}
