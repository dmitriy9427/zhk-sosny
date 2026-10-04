/**
 * Параллакс: элемент движется медленнее/быстрее прокрутки.
 *
 *   <div class="hero__bg" data-module="parallax" data-parallax-speed="0.3">
 *     <img src="…" alt="">
 *   </div>
 *
 * speed: 0 — стоит с контентом; 0.3 — заметно отстаёт; отрицательный — обгоняет.
 *
 * Баг, закрытый здесь: при сдвиге картинки у края блока появляется пустая
 * полоса. Если внутри одна картинка/видео — модуль сам увеличивает её
 * высоту на величину сдвига (запас сверху и снизу).
 * @module kit/modules/parallax
 */
import { gsap } from '../../core/gsap.js'
import { readOptions } from '../../core/options.js'

const DEFAULTS = {
  speed: 0.2,
}

export default function parallax(el, ctx = {}) {
  const options = readOptions(el, 'parallax', DEFAULTS, ctx.options)
  if (ctx.reduced || options.speed === 0) return

  const media =
    el.children.length === 1 && el.firstElementChild.matches('img, video, picture') ? el.firstElementChild : null
  const amount = options.speed * 100 // проценты высоты элемента
  const target = media ?? el

  if (media) {
    el.style.overflow = 'hidden'
    gsap.set(media, { height: `${100 + Math.abs(amount) * 2}%`, top: `${-Math.abs(amount)}%`, position: 'relative' })
  }

  const tween = gsap.fromTo(
    target,
    { yPercent: media ? -amount / 2 : -amount },
    {
      yPercent: media ? amount / 2 : amount,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
    },
  )

  return {
    destroy() {
      tween.scrollTrigger?.kill()
      tween.kill()
      gsap.set(target, { clearProps: 'all' })
      el.style.overflow = ''
    },
  }
}
