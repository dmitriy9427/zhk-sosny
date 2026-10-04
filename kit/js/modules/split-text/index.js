/**
 * Заголовок появляется по строкам/словам/буквам (SplitText).
 *
 *   <h2 data-module="split-text" data-split-text-type="lines">Длинный заголовок</h2>
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Разбили текст ДО загрузки шрифта — строки посчитаны по запасному шрифту,
 *    после загрузки переносы другие, текст «рвётся». autoSplit: true заново
 *    разбивает текст, когда шрифт загрузился или изменилась ширина блока,
 *    а onSplit пересоздаёт анимацию.
 * 2. Маска строк обрезает хвосты букв (у, р, д, щ). Стиль .split-mask в
 *    scss/components/_split-text.scss добавляет запас снизу.
 * 3. Скринридер читает текст по буквам. SplitText ставит aria-label на
 *    элемент с исходным текстом (aria: 'auto').
 * 4. Повторный запуск на уже разбитом тексте даёт «матрёшку» из span.
 *    destroy() вызывает revert() — текст возвращается к исходному.
 * @module kit/modules/split-text
 */
import { gsap, ScrollTrigger } from '../../core/gsap.js'
import { SplitText } from 'gsap/SplitText'
import { readOptions } from '../../core/options.js'

gsap.registerPlugin(SplitText)

const DEFAULTS = {
  /** 'lines' | 'words' | 'chars' — на какие части делить и что анимировать. */
  type: 'lines',
  start: 'top 85%',
  stagger: 0.08,
  duration: 0.9,
}

export default function splitText(el, ctx = {}) {
  const options = readOptions(el, 'split-text', DEFAULTS, ctx.options)
  if (!['lines', 'words', 'chars'].includes(options.type)) {
    throw new Error(`[kit] split-text: type должен быть lines, words или chars, а не «${options.type}»`)
  }
  if (ctx.reduced) {
    el.classList.add('is-revealed')
    return
  }

  // Для букв делим ещё и на слова — иначе слово может разорваться переносом посередине.
  const type = options.type === 'chars' ? 'words,chars' : options.type
  const split = SplitText.create(el, {
    type,
    mask: options.type === 'lines' ? 'lines' : undefined,
    linesClass: 'split-line',
    wordsClass: 'split-word',
    charsClass: 'split-char',
    autoSplit: true,
    aria: 'auto',
    onSplit(self) {
      el.classList.add('is-revealed')
      return gsap.from(self[options.type], {
        yPercent: options.type === 'lines' ? 110 : 60,
        opacity: options.type === 'lines' ? 1 : 0,
        duration: options.duration,
        stagger: options.stagger,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: options.start, once: true },
      })
    },
  })

  return {
    split,
    destroy() {
      // revert убирает и span-ы, и анимацию, созданную в onSplit (с её ScrollTrigger).
      split.revert()
      ScrollTrigger.getAll().forEach((t) => t.trigger === el && t.kill())
    },
  }
}
