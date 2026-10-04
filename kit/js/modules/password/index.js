/**
 * Показать/скрыть пароль.
 *
 *   <div class="field__control" data-module="password">
 *     <input class="field__input" type="password" name="password" autocomplete="new-password">
 *     <button class="field__action" type="button" data-password-toggle></button>
 *   </div>
 *
 * Кнопка: aria-pressed и подпись «Показать/Скрыть пароль» для скринридера.
 * Фокус и позиция курсора в поле сохраняются при переключении (баг многих
 * реализаций: после клика курсор прыгает в начало).
 * Перед отправкой формы поле возвращается в type="password" — иначе
 * браузер может запомнить пароль в истории автозаполнения как обычный текст.
 * @module kit/modules/password
 */
import { createDisposer } from '../../core/lifecycle.js'
import { t } from '../../core/i18n.js'

export default function password(root) {
  const input = root.querySelector('input')
  const button = root.querySelector('[data-password-toggle]')
  if (!input || !button) throw new Error('[kit] password: нужны <input> и [data-password-toggle] внутри')
  const d = createDisposer()

  const set = (visible) => {
    const { selectionStart, selectionEnd } = input
    input.type = visible ? 'text' : 'password'
    button.setAttribute('aria-pressed', String(visible))
    button.setAttribute('aria-label', t(visible ? 'kit.password.hide' : 'kit.password.show'))
    if (document.activeElement === input) input.setSelectionRange(selectionStart, selectionEnd)
  }
  set(false)
  button.type = 'button'
  d.listen(button, 'mousedown', (e) => e.preventDefault()) // не забирать фокус у поля
  d.listen(button, 'click', () => set(input.type === 'password'))
  if (input.form) d.listen(input.form, 'submit', () => set(false), true)
  d.add(() => set(false))
  return { show: () => set(true), hide: () => set(false), destroy: d.dispose }
}
