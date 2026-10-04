/**
 * Текст «расшифровывается» случайными символами (ScrambleText).
 *
 *   <h2 data-module="scramble-text">Цифровые продукты</h2>            ← при появлении
 *   <a data-module="scramble-text" data-scramble-text-on="hover">Кейсы</a> ← при наведении
 *
 * Текст в разметке — итоговый (его видят поисковики и скринридеры, у которых
 * aria-label фиксируется на время анимации).
 * Баг, закрытый здесь: при наведении ширина ссылки «дёргается» от разных
 * символов — на время анимации фиксируется ширина элемента.
 * @module kit/modules/scramble-text
 */
import { gsap } from '../../core/gsap.js'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { createDisposer, onViewport } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { canHover } from '../../core/env.js'

gsap.registerPlugin(ScrambleTextPlugin)

const DEFAULTS = {
  /** Когда запускать: 'view' (при появлении) или 'hover'. */
  on: 'view',
  /** Символы «шума»: 'upperCase', 'lowerCase', '0123456789' или свои. */
  chars: 'upperAndLowerCase',
  duration: 1.2,
}

export default function scrambleText(el, ctx = {}) {
  const options = readOptions(el, 'scramble-text', DEFAULTS, ctx.options)
  if (ctx.reduced) return undefined
  const d = createDisposer()
  const text = el.textContent
  el.setAttribute('aria-label', text.trim())
  let tween = null

  const play = () => {
    el.style.minWidth = `${el.offsetWidth}px`
    tween?.kill()
    tween = gsap.to(el, {
      duration: options.duration,
      scrambleText: { text, chars: options.chars, speed: 0.6, revealDelay: 0.2 },
      onComplete: () => (el.style.minWidth = ''),
    })
  }

  if (options.on === 'hover') {
    if (canHover()) d.listen(el, 'pointerenter', play)
    d.listen(el, 'focus', play)
  } else {
    d.add(onViewport(el, { once: true, threshold: 0.4, enter: play }))
  }
  d.add(() => {
    tween?.kill()
    el.textContent = text
    el.style.minWidth = ''
  })
  return { play, destroy: d.dispose }
}
