/**
 * Появление элементов при прокрутке.
 *
 *   <section data-module="reveal">
 *     <h2 data-reveal>Заголовок</h2>
 *     <p data-reveal="fade">Текст</p>
 *     <ul> <li data-reveal="up" data-reveal-delay="0.1">…</li> … </ul>
 *   </section>
 *
 * Модуль ставится на контейнер (хоть на <main>) и анимирует всех потомков с
 * data-reveal (и сам контейнер, если у него есть data-reveal). Элементы,
 * которые появляются одновременно (ряд карточек), идут «волной» —
 * ScrollTrigger.batch.
 *
 * Пресеты (значение data-reveal): up (по умолчанию), down, left, right,
 * fade, scale, clip. Свой пресет — добавьте в PRESETS.
 *
 * ─── Как избегаем «мигания» ─────────────────────────────────────────────────
 * CSS прячет [data-reveal] (opacity: 0), пока у него нет класса is-revealed,
 * и только при включённом JS (base/_a11y.scss). Модуль в момент запуска ставит
 * is-revealed и ТУТ ЖЕ, в том же кадре, задаёт начальное состояние через
 * gsap.set — пользователь не видит промежуточного кадра.
 * Если пользователь просил меньше анимаций — просто показываем всё.
 * @module kit/modules/reveal
 */
import { gsap, ScrollTrigger } from '../../core/gsap.js'
import { readOptions } from '../../core/options.js'

export const PRESETS = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
  fade: {},
  scale: { scale: 0.92 },
  clip: { clipPath: 'inset(0 0 100% 0)', to: { clipPath: 'inset(0 0 0% 0)' } },
}

const DEFAULTS = {
  /** Когда запускать: 'top 85%' — верх элемента дошёл до 85% высоты экрана. */
  start: 'top 85%',
  duration: 0.9,
  /** Задержка между элементами «волны», с. */
  stagger: 0.08,
  /** Проиграть один раз (true) или прятать при уходе вверх (false). */
  once: true,
}

/** Элемент сейчас в пределах экрана (и вообще отрисован). */
export function inViewport(el) {
  const rect = el.getBoundingClientRect()
  return rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0
}

export default function reveal(root, ctx = {}) {
  const options = readOptions(root, 'reveal', DEFAULTS, ctx.options)
  const targets = [...(root.hasAttribute('data-reveal') ? [root] : []), ...root.querySelectorAll('[data-reveal]')]
  if (!targets.length) return

  if (ctx.reduced) {
    targets.forEach((el) => el.classList.add('is-revealed'))
    return
  }

  const presetOf = (el) => {
    const name = el.dataset.reveal || 'up'
    if (!PRESETS[name]) console.warn(`[kit] reveal: нет пресета «${name}». Есть: ${Object.keys(PRESETS).join(', ')}`)
    return PRESETS[name] ?? PRESETS.up
  }

  // Уже видны при загрузке (первый экран) — показываем сразу. Иначе всё, что
  // ниже линии start ('top 85%'), но на экране — например, цифры внизу hero, —
  // висело бы невидимым, пока не прокрутишь. Мерить — ДО gsap.set (сдвиг y).
  const visible = new Set(targets.filter(inViewport))

  targets.forEach((el) => {
    const { to: _to, ...from } = presetOf(el) // to — конечное состояние, здесь не нужно
    el.classList.add('is-revealed')
    gsap.set(el, { opacity: 0, ...from })
  })

  const show = (batch) =>
    gsap.to(batch, {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      ...(presetOf(batch[0]).to ?? {}),
      duration: options.duration,
      ease: 'power3.out',
      stagger: options.stagger,
      delay: (i, el) => Number(el.dataset.revealDelay) || 0,
      overwrite: true,
      // После анимации убираем inline transform — иначе он создаёт новый
      // контекст наложения и ломает position: fixed/sticky у потомков.
      clearProps: 'transform,clipPath',
    })

  if (visible.size) show([...visible])
  const rest = targets.filter((el) => !visible.has(el))
  const triggers = ScrollTrigger.batch(rest, {
    start: options.start,
    once: options.once,
    onEnter: show,
    onLeaveBack: options.once
      ? undefined
      : (batch) => gsap.to(batch, { opacity: 0, ...presetOf(batch[0]), duration: 0.3, overwrite: true }),
  })

  return {
    destroy() {
      triggers.forEach((t) => t.kill())
      gsap.killTweensOf(targets)
      gsap.set(targets, { clearProps: 'all' })
      targets.forEach((el) => el.classList.remove('is-revealed'))
    },
  }
}
