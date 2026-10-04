/**
 * «Магнитная» кнопка: тянется за курсором, пока он над ней, и пружиной
 * возвращается на место, когда курсор ушёл.
 *
 *   <a class="btn" href="#" data-module="magnetic" data-magnetic-strength="0.3">Связаться</a>
 *
 * Только для мыши: на тач-экранах эффект бессмыслен и мешает тапу.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. «Прилипает только в первый раз». Возврат пружиной делался через
 *    gsap.to(..., { overwrite: 'auto' }). Если курсор уходил, пока кнопка ещё
 *    ехала за ним (живая мышь так и делает), overwrite убивал твины quickTo —
 *    и при следующих наведениях двигать кнопку было уже нечем. Теперь quickTo
 *    создаются заново при каждом наведении (overwrite: true — они сами
 *    снимают недоигранный возврат).
 * 2. Кнопка «уплывала»: центр считался по getBoundingClientRect, который
 *    включает текущий сдвиг кнопки. Вычитаем свой сдвиг — центр неподвижен.
 * Тест на оба случая — modules-motion.test.js.
 * @module kit/modules/magnetic
 */
import { gsap } from '../../core/gsap.js'
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { canHover } from '../../core/env.js'

const DEFAULTS = {
  /** Насколько сильно тянется: доля от расстояния курсора до центра. */
  strength: 0.35,
}

/**
 * Сдвиг кнопки к курсору: (курсор − центр кнопки без учёта её сдвига) × сила.
 * @param {{ left: number, top: number, width: number, height: number }} rect Рамка с учётом сдвига.
 * @param {{ x: number, y: number }} offset Текущий сдвиг кнопки.
 */
export function magneticShift(rect, offset, pointer, strength) {
  const cx = rect.left - offset.x + rect.width / 2
  const cy = rect.top - offset.y + rect.height / 2
  return { x: (pointer.x - cx) * strength, y: (pointer.y - cy) * strength }
}

export default function magnetic(el, ctx = {}) {
  if (ctx.reduced || !canHover()) return undefined
  const options = readOptions(el, 'magnetic', DEFAULTS, ctx.options)
  const d = createDisposer()
  let follow = null

  const start = () => {
    follow = {
      x: gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out', overwrite: true }),
      y: gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out', overwrite: true }),
    }
  }

  d.listen(el, 'pointerenter', start)
  d.listen(el, 'pointermove', (event) => {
    if (!follow) start() // курсор уже был над кнопкой при загрузке страницы
    const shift = magneticShift(
      el.getBoundingClientRect(),
      { x: Number(gsap.getProperty(el, 'x')) || 0, y: Number(gsap.getProperty(el, 'y')) || 0 },
      { x: event.clientX, y: event.clientY },
      options.strength,
    )
    follow.x(shift.x)
    follow.y(shift.y)
  })
  d.listen(el, 'pointerleave', () => {
    follow = null
    gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)', overwrite: true })
  })
  d.add(() => {
    gsap.killTweensOf(el)
    gsap.set(el, { clearProps: 'transform' })
  })
  return { destroy: d.dispose }
}
