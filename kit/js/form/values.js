/**
 * Значения формы → обычный объект (как getValues() в react-hook-form).
 *
 *   formValues(form) → { name: 'Иван', consent: true, services: ['seo', 'ads'], files: [File] }
 *
 * Правила (то, на чём обычно спотыкаются с FormData):
 * - одиночный чекбокс → true/false (FormData вообще не содержит неотмеченный);
 * - несколько чекбоксов с одним именем или имя с [] → массив отмеченных значений;
 * - радиокнопки → значение отмеченной или '' (ничего не выбрано);
 * - select multiple → массив;
 * - файлы → массив File (пустой, если ничего не выбрано);
 * - выключенные (disabled) поля и кнопки не попадают — как в обычной отправке.
 * @module kit/form/values
 */

export function formValues(form) {
  const values = {}
  const elements = Array.from(form.elements).filter(
    (el) =>
      el.name && !el.disabled && !['submit', 'button', 'reset', 'image'].includes(el.type) && el.tagName !== 'FIELDSET',
  )
  const count = (name) => elements.filter((el) => el.name === name).length

  for (const el of elements) {
    const isList = el.name.endsWith('[]')
    const key = isList ? el.name.slice(0, -2) : el.name
    if (el.type === 'checkbox') {
      if (isList || count(el.name) > 1) {
        values[key] ??= []
        if (el.checked) values[key].push(el.value)
      } else values[key] = el.checked
    } else if (el.type === 'radio') {
      values[key] ??= ''
      if (el.checked) values[key] = el.value
    } else if (el.type === 'file') {
      values[key] = Array.from(el.files ?? [])
    } else if (el.tagName === 'SELECT' && el.multiple) {
      values[key] = Array.from(el.selectedOptions, (o) => o.value)
    } else if (isList) {
      ;(values[key] ??= []).push(el.value)
    } else values[key] = el.value
  }
  return values
}

/** Все поля формы с этим именем (с учётом name="x[]"). */
export const fieldsByName = (form, key) =>
  Array.from(form.elements).filter((el) => el.name === key || el.name === `${key}[]`)
