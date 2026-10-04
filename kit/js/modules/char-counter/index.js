/**
 * Счётчик символов под полем: «120 / 500».
 *
 *   <textarea name="message" maxlength="500" data-module="char-counter"></textarea>
 *
 * Лимит — из maxlength (или data-char-counter-max, если обрезать ввод не нужно,
 * а только предупредить — тогда проверку длины делает схема/форма).
 * Скринридер узнаёт об остатке, только когда до лимита ≤ 10% — иначе он
 * зачитывал бы каждый введённый символ.
 * @module kit/modules/char-counter
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { t } from '../../core/i18n.js'

const DEFAULTS = { max: 0 }

export default function charCounter(field, ctx = {}) {
  const options = readOptions(field, 'char-counter', DEFAULTS, ctx.options)
  const max = options.max || field.maxLength
  if (!(max > 0)) throw new Error('[kit] char-counter: задайте maxlength или data-char-counter-max')
  const d = createDisposer()
  const counter = document.createElement('span')
  counter.className = 'field__counter'
  const live = document.createElement('span')
  live.className = 'visually-hidden'
  live.setAttribute('aria-live', 'polite')
  field.after(counter, live)

  const update = () => {
    const length = field.value.length
    const left = max - length
    counter.textContent = `${length} / ${max}`
    counter.classList.toggle('is-over', left < 0)
    counter.classList.toggle('is-near', left >= 0 && left <= max * 0.1)
    live.textContent = left <= max * 0.1 ? t('kit.counter.left', { count: left }) : ''
  }
  update()
  d.listen(field, 'input', update)
  if (field.form) d.listen(field.form, 'reset', () => setTimeout(update))
  d.add(() => {
    counter.remove()
    live.remove()
  })
  return { update, destroy: d.dispose }
}
