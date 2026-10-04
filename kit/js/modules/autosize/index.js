/**
 * Textarea растёт по мере ввода текста.
 *
 *   <textarea class="field__input" data-module="autosize" rows="3"></textarea>
 *
 * В новых браузерах это делает CSS: field-sizing: content (класс is-autosize).
 * Для остальных — JS: height = scrollHeight на каждый ввод.
 * Ограничить рост — CSS max-height (дальше появится прокрутка).
 * Баг, закрытый здесь: после reset() формы поле оставалось высоким.
 * @module kit/modules/autosize
 */
import { createDisposer } from '../../core/lifecycle.js'

export default function autosize(textarea) {
  const d = createDisposer()
  textarea.classList.add('is-autosize')
  if (globalThis.CSS?.supports?.('field-sizing', 'content')) {
    return { destroy: () => textarea.classList.remove('is-autosize') }
  }
  const fit = () => {
    textarea.style.height = 'auto' // сначала сжать — иначе поле не уменьшится при удалении текста
    const border = textarea.offsetHeight - textarea.clientHeight
    textarea.style.height = `${textarea.scrollHeight + border}px`
  }
  fit()
  d.listen(textarea, 'input', fit)
  if (textarea.form) d.listen(textarea.form, 'reset', () => setTimeout(fit))
  d.add(() => {
    textarea.style.height = ''
    textarea.classList.remove('is-autosize')
  })
  return { fit, destroy: d.dispose }
}
