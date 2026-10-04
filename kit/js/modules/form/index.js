/**
 * Форма: проверка как в react-hook-form + zod, маски, отправка без перезагрузки,
 * ошибки с сервера под полями.
 *
 *   <form data-module="form" data-form-ajax data-form-schema="callback"
 *         action="/api/callback" method="post" novalidate>
 *     <label class="field">
 *       <span class="field__label">Телефон</span>
 *       <input class="field__input" name="phone" type="tel" data-mask="phone">
 *     </label>
 *     <button class="btn" type="submit">Отправить</button>
 *     <p data-form-status role="status"></p>
 *   </form>
 *
 * ─── Откуда берутся правила ─────────────────────────────────────────────────
 * 1. Схема (рекомендуется): data-form-schema="имя" + registerSchema('имя', s.object({…}))
 *    или ctx.options.schema из JS/React. Подходит и zod-схема (есть safeParse).
 * 2. HTML-атрибуты (required, type="email", minlength, pattern, min/max) —
 *    для полей, которых нет в схеме, или если схемы нет совсем. Тексты ошибок
 *    русские; свой текст — data-error-required, data-error-type, data-error-pattern…
 * 3. Маска: поле с data-mask, заполненное не до конца, — ошибка
 *    «Заполните полностью» (свой текст — data-error-mask).
 *
 * ─── Когда проверять (mode, как в react-hook-form) ─────────────────────────
 *   onTouched (по умолчанию) — первый раз при уходе с поля, дальше на каждый ввод;
 *   onBlur — при уходе с поля;  onChange — на каждый ввод;
 *   onSubmit — только при отправке;  all — и при вводе, и при уходе.
 * После первой попытки отправки все поля проверяются на каждый ввод — ошибка
 * исчезает, как только её исправили (reValidateMode: onChange в RHF).
 *
 * ─── Отправка ───────────────────────────────────────────────────────────────
 * - onSubmit (из JS/React): ctx.options.onSubmit(data, api) — ваш код решает,
 *   что делать; выбросите ошибку с полем errors — покажутся под полями;
 * - data-form-ajax: fetch на action формы (FormData, файлы тоже);
 *   ответ 4xx { errors: { phone: 'Номер занят' } } — ошибки под полями
 *   (формат Laravel { phone: ['…'] } тоже понимаем);
 * - иначе — обычная отправка браузером, если всё верно.
 * События на <form>: form:invalid, form:submit (можно отменить), form:success, form:error.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Двойная отправка двойным кликом — кнопка блокируется на время запроса.
 * 2. После reset() остаются красные поля — чистим; кастомные поля (селекты,
 *    загрузка файлов) получают change и перерисовываются.
 * 3. Ошибка «пароли не совпадают» не исчезает, когда исправили ПЕРВОЕ поле —
 *    при любом вводе перепроверяются поля, на которых сейчас висит ошибка.
 * 4. Ошибки не читаются скринридером — aria-invalid, aria-describedby, role="alert".
 * 5. Ошибка за пределами экрана — фокус на первое неверное поле.
 * 6. reset() после успеха стирал сообщение «Спасибо» — сохраняем.
 * 7. Ошибка с сервера («e-mail занят») пропадала при уходе с поля, хотя
 *    значение то же. Держится, пока значение не изменят.
 * @module kit/modules/form
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { ensureId } from '../../core/dom.js'
import { getSchema } from '../../form/index.js'
import { attachMask, getMask } from '../../form/mask.js'
import { fieldsByName, formValues } from '../../form/values.js'
import { t } from '../../core/i18n.js'

const DEFAULTS = {
  /** Отправлять через fetch без перезагрузки страницы. */
  ajax: false,
  /** Когда проверять: onTouched | onBlur | onChange | onSubmit | all. */
  mode: 'onTouched',
  /** Имя схемы из registerSchema (или объект схемы в ctx.options.schema). */
  schema: '',
  /** Очищать форму после успешной отправки. */
  resetOnSuccess: true,
  /** Текст при успехе (если сервер не прислал message). Пусто — из словаря kit.form.success. */
  success: '',
  /** Текст при ошибке сервера/сети. */
  failure: '',
  /** Текст в статусе, если есть ошибки в полях. */
  invalid: '',
}

const MODES = ['onTouched', 'onBlur', 'onChange', 'onSubmit', 'all']
const SKIP_TYPES = ['submit', 'button', 'reset', 'image', 'hidden']

/**
 * Текст ошибки по HTML-атрибутам поля (Constraint Validation API).
 * @param {HTMLInputElement} el
 * @returns {string} '' — ошибок нет
 */
export function messageFor(el) {
  const v = el.validity
  const own = (key) => el.dataset[`error${key}`]
  // Браузер считает tooShort/tooLong только для текста, введённого руками.
  // Значение из автозаполнения или из JS он пропускает — проверяем длину сами.
  const length = el.value?.length ?? 0
  if (el.minLength > 0 && length > 0 && length < el.minLength) {
    return own('Length') ?? t('kit.form.minLength', { min: el.minLength, length })
  }
  if (el.maxLength > 0 && length > el.maxLength) return own('Length') ?? t('kit.form.maxLength', { max: el.maxLength })
  if (v.valid) return ''
  if (v.valueMissing) {
    if (own('Required')) return own('Required')
    if (el.type === 'checkbox') return t('kit.schema.checked')
    if (el.type === 'radio' || el.tagName === 'SELECT') return t('kit.schema.choose')
    if (el.type === 'file') return t('kit.schema.fileRequired')
    return t('kit.schema.required')
  }
  if (v.typeMismatch) {
    return own('Type') ?? { email: t('kit.schema.email'), url: t('kit.schema.url') }[el.type] ?? t('kit.schema.format')
  }
  if (v.tooShort) return own('Length') ?? t('kit.form.minLength', { min: el.minLength, length: el.value.length })
  if (v.tooLong) return own('Length') ?? t('kit.form.maxLength', { max: el.maxLength })
  if (v.rangeUnderflow) return own('Range') ?? t('kit.schema.min', { min: el.min })
  if (v.rangeOverflow) return own('Range') ?? t('kit.schema.max', { max: el.max })
  if (v.stepMismatch) return own('Range') ?? t('kit.form.step', { step: el.step })
  if (v.patternMismatch) return own('Pattern') ?? t('kit.schema.format')
  if (v.badInput) return t('kit.schema.invalid')
  if (v.customError) return el.validationMessage
  return t('kit.schema.invalid')
}

/** Первая ошибка из ответа сервера: { errors: { phone: 'x' } } или { phone: ['x'] }. */
export function serverErrors(payload) {
  const source = payload?.errors ?? {}
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, Array.isArray(value) ? String(value[0]) : String(value)]),
  )
}

export default function form(el, ctx = {}) {
  if (el.tagName !== 'FORM') throw new Error('[kit] form: модуль ставится на <form>')
  const options = readOptions(el, 'form', DEFAULTS, ctx.options)
  if (!MODES.includes(options.mode)) throw new Error(`[kit] form: mode «${options.mode}» — есть ${MODES.join(', ')}`)
  const schema =
    typeof options.schema === 'string' ? (options.schema ? getSchema(options.schema) : null) : options.schema
  const onSubmit = ctx.options?.onSubmit

  const d = createDisposer()
  el.noValidate = true
  const status = el.querySelector('[data-form-status]')
  const successBox = el.querySelector('[data-form-success]')
  const touched = new Set()
  let errors = {}
  // Ошибки, выставленные снаружи (сервер, setErrors): поле → значение, при
  // котором ошибка выставлена. Держится, пока значение не изменится, —
  // иначе ушли с поля, клиентская проверка прошла, и «e-mail занят» пропал.
  const manual = new Map()
  let submitted = false
  let busy = false
  let keepStatus = false

  // ─── Поля ────────────────────────────────────────────────────────────────
  const elements = () =>
    Array.from(el.elements).filter(
      (f) => f.name && !f.disabled && !SKIP_TYPES.includes(f.type) && f.tagName !== 'FIELDSET',
    )
  const keyOf = (field) => field.name.replace(/\[\]$/, '')
  /** Имена полей в порядке DOM (группа чекбоксов — одно имя). */
  const keys = () => [...new Set(elements().map(keyOf))]

  // Маски — для всех полей с data-mask / data-mask-pattern.
  el.querySelectorAll('[data-mask], [data-mask-pattern]').forEach((input) => {
    const handle = attachMask(input)
    if (handle) d.add(handle.destroy)
  })

  // ─── Показ ошибок ───────────────────────────────────────────────────────
  function errorBox(key) {
    const [first, ...rest] = fieldsByName(el, key)
    if (!first) return null
    const group = rest.length > 0
    const wrap =
      first.closest('[data-field]') ??
      (group ? first.closest('fieldset') : null) ??
      first.closest('.field') ??
      first.parentElement
    let box = wrap.querySelector('[data-form-error]')
    if (!box) {
      box = document.createElement('p')
      box.className = 'field__error'
      box.setAttribute('data-form-error', '')
      wrap.append(box)
    }
    box.id ||= `${ensureId(first, 'field')}-error`
    return box
  }

  function show(key, message) {
    if (message) errors[key] = message
    else delete errors[key]
    const box = errorBox(key)
    if (!box) return
    box.textContent = message
    if (message) box.setAttribute('role', 'alert')
    else box.removeAttribute('role')
    for (const field of fieldsByName(el, key)) {
      field.setAttribute('aria-invalid', String(Boolean(message)))
      const described = new Set((field.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean))
      if (message) described.add(box.id)
      else described.delete(box.id)
      if (described.size) field.setAttribute('aria-describedby', [...described].join(' '))
      else field.removeAttribute('aria-describedby')
      field.closest('[data-field], .field')?.classList.toggle('is-invalid', Boolean(message))
    }
  }

  // ─── Проверка ───────────────────────────────────────────────────────────
  /** Проверка по HTML-атрибутам и маске. */
  function nativeMessage(key) {
    for (const field of fieldsByName(el, key)) {
      if (field.disabled) continue
      const mask = getMask(field)
      if (mask && field.value && !mask.isComplete(field.value))
        return field.dataset.errorMask ?? t('kit.form.incomplete')
      const message = messageFor(field)
      if (message) return message
    }
    return ''
  }

  const inSchema = (key) => Boolean(schema?.shape?.[key]) || (schema && !schema.shape)

  /** Проверить одно поле. @returns {string} текст ошибки или '' */
  function validateKey(key) {
    const current = JSON.stringify(formValues(el)[key] ?? null)
    if (manual.has(key)) {
      if (manual.get(key) === current) return errors[key] ?? ''
      manual.delete(key) // значение поменяли — ошибка сервера больше не актуальна
    }
    let message
    if (inSchema(key)) {
      const values = formValues(el)
      // Своя схема умеет проверять одно поле (only); zod — проверяем всё и берём нужное.
      const result = schema.shape && !schema._def ? schema.safeParse(values, { only: key }) : schema.safeParse(values)
      message = pickError(result, key)
    } else message = nativeMessage(key)
    show(key, message)
    return message
  }

  /** Проверить всю форму. */
  function validateAll() {
    manual.clear() // повторная отправка — сервер проверит заново
    const values = formValues(el)
    let data = values
    const next = {}
    if (schema) {
      const result = schema.safeParse(values)
      if (result.success) data = { ...values, ...result.data }
      for (const key of keys()) {
        const message = inSchema(key) ? pickError(result, key) : nativeMessage(key)
        if (message) next[key] = message
      }
      // Ошибки refine без поля (path не указан) — в общий статус.
      const general = pickError(result, '_')
      if (general) next._ = general
    } else {
      for (const key of keys()) {
        const message = nativeMessage(key)
        if (message) next[key] = message
      }
    }
    keys().forEach((key) => show(key, next[key] ?? ''))
    errors = next
    return { success: Object.keys(next).length === 0, data, errors: { ...next } }
  }

  function setStatus(text, type = '') {
    if (!status) return
    status.textContent = text
    status.dataset.type = type
  }

  function focusFirstError() {
    const first = elements().find((f) => errors[keyOf(f)])
    first?.focus()
  }

  /** Показать ошибки (например, с сервера): { phone: 'Номер уже зарегистрирован' }. */
  function setErrors(map) {
    const values = formValues(el)
    for (const [key, message] of Object.entries(map)) {
      manual.set(key, JSON.stringify(values[key] ?? null))
      if (fieldsByName(el, key).length) show(key, message)
      else errors[key] = message
    }
    focusFirstError()
  }

  // ─── События полей ──────────────────────────────────────────────────────
  const shouldValidateOnChange = (key) =>
    submitted ||
    options.mode === 'onChange' ||
    options.mode === 'all' ||
    (options.mode === 'onTouched' && touched.has(key))

  const onValueChange = (event) => {
    const field = event.target
    if (!field.name || !field.form || field.form !== el) return
    const key = keyOf(field)
    if (shouldValidateOnChange(key)) validateKey(key)
    // Перепроверить поля с ошибками: «пароли не совпадают» исчезнет, когда
    // поправили первое поле, а не второе.
    Object.keys(errors)
      .filter((other) => other !== key && other !== '_')
      .forEach(validateKey)
  }
  d.listen(el, 'input', onValueChange)
  d.listen(el, 'change', onValueChange)

  d.listen(el, 'focusin', (event) => {
    const field = event.target
    // Телефон: сразу показать «+7 (», чтобы было понятно, что код вводить не нужно.
    if (field.dataset?.mask === 'phone' && !field.value) field.value = '+7 ('
  })

  d.listen(el, 'focusout', (event) => {
    const field = event.target
    if (!field.name || field.form !== el) return
    const mask = getMask(field)
    if (mask && !mask.unmask(field.value)) field.value = '' // остался только «+7 (»
    const key = keyOf(field)
    // У группы чекбоксов «уход» — только когда фокус ушёл из всей группы.
    if (event.relatedTarget?.name === field.name) return
    if (['onBlur', 'onTouched', 'all'].includes(options.mode) || submitted) {
      touched.add(key)
      validateKey(key)
    }
  })

  // ─── Сброс ──────────────────────────────────────────────────────────────
  d.listen(el, 'reset', () => {
    // reset срабатывает ДО очистки значений — ждём один тик.
    setTimeout(() => {
      touched.clear()
      manual.clear()
      submitted = false
      keys().forEach((key) => show(key, ''))
      errors = {}
      elements().forEach((f) => f.dispatchEvent(new Event('change', { bubbles: true })))
      // change выше мог снова навесить ошибки на «перепроверку» — после reset их нет.
      keys().forEach((key) => show(key, ''))
      errors = {}
      if (!keepStatus) setStatus('')
      keepStatus = false
    })
  })

  // ─── Отправка ───────────────────────────────────────────────────────────
  function lock(on) {
    busy = on
    el.classList.toggle('is-loading', on)
    el.querySelectorAll('[type="submit"]').forEach((b) => {
      b.disabled = on
      b.toggleAttribute('aria-busy', on)
    })
  }

  async function send(data) {
    if (onSubmit) return onSubmit(data, api)
    const response = await fetch(el.action, {
      method: (el.getAttribute('method') ?? 'post').toUpperCase(),
      body: new FormData(el),
      headers: { Accept: 'application/json' },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw Object.assign(new Error(payload.message ?? response.statusText), { payload })
    return payload
  }

  d.listen(el, 'submit', async (event) => {
    submitted = true
    const result = validateAll()
    if (!result.success) {
      event.preventDefault()
      setStatus(result.errors._ ?? (options.invalid || t('kit.form.invalid')), 'error')
      focusFirstError()
      el.dispatchEvent(new CustomEvent('form:invalid', { bubbles: true, detail: { errors: result.errors } }))
      return
    }
    const proceed = el.dispatchEvent(
      new CustomEvent('form:submit', { bubbles: true, cancelable: true, detail: { data: result.data } }),
    )
    if (!proceed) return event.preventDefault()
    if (!options.ajax && !onSubmit) return // обычная отправка браузером
    event.preventDefault()
    if (busy) return
    lock(true)
    setStatus('')
    try {
      const payload = (await send(result.data)) ?? {}
      el.dispatchEvent(new CustomEvent('form:success', { bubbles: true, detail: payload }))
      ctx.bus?.emit('form:success', { form: el, data: payload })
      if (options.resetOnSuccess) {
        keepStatus = true
        el.reset()
      }
      if (successBox) successBox.hidden = false
      setStatus(payload.message ?? (options.success || t('kit.form.success')), 'success')
    } catch (error) {
      const fieldErrors = error.errors ?? serverErrors(error.payload)
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
      el.dispatchEvent(new CustomEvent('form:error', { bubbles: true, detail: error }))
      setStatus(
        error.payload?.message ??
          (Object.keys(fieldErrors).length
            ? options.invalid || t('kit.form.invalid')
            : options.failure || t('kit.form.failure')),
        'error',
      )
    } finally {
      lock(false)
    }
  })

  const api = {
    /** Значения формы как объект. */
    getValues: () => formValues(el),
    /** Проверить всё: { success, data, errors }. */
    validate: validateAll,
    /** Проверить одно поле. */
    validateField: validateKey,
    setErrors,
    clearErrors: () => {
      manual.clear()
      keys().forEach((key) => show(key, ''))
    },
    get errors() {
      return { ...errors }
    },
    reset: () => el.reset(),
    /** Отправить программно (с проверкой) — как нажатие кнопки. */
    submit: () => el.requestSubmit(),
    destroy: d.dispose,
  }
  return api
}

/**
 * Ошибка поля из результата safeParse — и нашей схемы ({ errors }), и zod
 * ({ error.issues: [{ path, message }] }).
 */
function pickError(result, key) {
  if (result.success) return ''
  if (result.errors) return result.errors[key] ?? ''
  const issue = result.error?.issues?.find((i) => (i.path?.[0] ?? '_') === key)
  return issue?.message ?? ''
}
