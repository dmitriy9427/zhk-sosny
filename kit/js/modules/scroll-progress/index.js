/**
 * Полоса прогресса чтения: сколько страницы (или статьи) прочитано.
 *
 *   <div class="scroll-progress" data-module="scroll-progress"></div>          ← вся страница
 *   <div class="scroll-progress" data-module="scroll-progress" data-scroll-progress-target="#article"></div>
 *
 * Пишет --progress (0…1) — полосу рисует CSS (scaleX), её же можно
 * использовать для любых эффектов. role="progressbar" для скринридеров.
 * @module kit/modules/scroll-progress
 */
import { ScrollTrigger } from '../../core/gsap.js'
import { readOptions } from '../../core/options.js'

const DEFAULTS = { target: '' }

export default function scrollProgress(el, ctx = {}) {
  const options = readOptions(el, 'scroll-progress', DEFAULTS, ctx.options)
  const target = options.target ? document.querySelector(options.target) : document.documentElement
  if (!target) throw new Error(`[kit] scroll-progress: нет элемента ${options.target}`)
  el.setAttribute('role', 'progressbar')
  el.setAttribute('aria-valuemin', '0')
  el.setAttribute('aria-valuemax', '100')
  const trigger = ScrollTrigger.create({
    trigger: target,
    start: options.target ? 'top top' : 0,
    end: options.target ? 'bottom bottom' : 'max',
    onUpdate: (self) => {
      el.style.setProperty('--progress', self.progress.toFixed(4))
      el.setAttribute('aria-valuenow', String(Math.round(self.progress * 100)))
    },
  })
  return { destroy: () => trigger.kill() }
}
