/**
 * Тесты формы и модулей полей: режимы проверки, схема, ошибки сервера,
 * маски, загрузка файлов, пароль, счётчик, степпер, autosize.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import form, { messageFor, serverErrors } from './form/index.js'
import fileUpload, { pickFiles } from './file-upload/index.js'
import password from './password/index.js'
import charCounter from './char-counter/index.js'
import stepper, { stepValue } from './stepper/index.js'
import autosize from './autosize/index.js'
import mask from './mask/index.js'
import { registerSchema, s } from '../form/index.js'
import { createCtx, html, tick } from '@test/helpers.js'

afterEach(() => vi.unstubAllGlobals())

const type = (input, value) => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const blur = (input) => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
const submit = (el) => {
  const event = new Event('submit', { cancelable: true })
  el.dispatchEvent(event)
  return event
}
const errorOf = (el, name) =>
  (el.querySelector(`[name="${name}"]`).closest('.field') ?? el).querySelector('[data-form-error]')?.textContent ?? ''

describe('form: проверка по HTML-атрибутам', () => {
  it('messageFor — русские тексты', () => {
    expect(messageFor(html('<input required>'))).toBe('Заполните поле')
    expect(messageFor(html('<input type="email" value="x">'))).toContain('e-mail')
    expect(messageFor(html('<input required data-error-required="Как вас зовут?">'))).toBe('Как вас зовут?')
    expect(messageFor(html('<input type="file" required>'))).toBe('Прикрепите файл')
    expect(messageFor(html('<input value="ok">'))).toBe('')
  })

  it('неверная форма не отправляется: ошибки, aria, фокус, статус, событие invalid', () => {
    const el = html(`<form><label class="field"><input name="name" required></label><p data-form-status></p></form>`)
    form(el)
    const invalid = vi.fn()
    el.addEventListener('form:invalid', invalid)
    expect(submit(el).defaultPrevented).toBe(true)
    const input = el.querySelector('input')
    expect(errorOf(el, 'name')).toBe('Заполните поле')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain('-error')
    expect(document.activeElement).toBe(input)
    expect(el.querySelector('[data-form-status]').textContent).toBe('Проверьте выделенные поля')
    expect(invalid).toHaveBeenCalled()
    type(input, 'Иван') // после попытки отправки — проверка на каждый ввод
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })

  it('незаполненная маска — «Заполните полностью»', () => {
    const el = html(`<form><label class="field"><input name="phone" data-mask="phone"></label></form>`)
    form(el)
    const input = el.querySelector('input')
    type(input, '912')
    blur(input)
    expect(errorOf(el, 'phone')).toBe('Заполните полностью')
    expect(input.value).toBe('+7 (912')
  })

  it('телефон: «+7 (» при фокусе, пусто после ухода без ввода', () => {
    const el = html(`<form><label class="field"><input name="phone" data-mask="phone"></label></form>`)
    form(el)
    const input = el.querySelector('input')
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(input.value).toBe('+7 (')
    blur(input)
    expect(input.value).toBe('')
  })
})

describe('form: режимы проверки (как mode в react-hook-form)', () => {
  const make = (mode) => {
    const el = html(
      `<form data-form-mode="${mode}"><label class="field"><input name="name" required minlength="3"></label></form>`,
    )
    form(el)
    return { el, input: el.querySelector('input') }
  }

  it('onTouched: не ругается при первом вводе, ругается после ухода, дальше — на каждый ввод', () => {
    const { el, input } = make('onTouched')
    type(input, 'a')
    expect(errorOf(el, 'name')).toBe('')
    blur(input)
    expect(errorOf(el, 'name')).toContain('Минимум 3')
    type(input, 'abc')
    expect(errorOf(el, 'name')).toBe('')
  })

  it('onChange — сразу; onSubmit — только при отправке; onBlur — при уходе', () => {
    const a = make('onChange')
    type(a.input, 'a')
    expect(errorOf(a.el, 'name')).toContain('Минимум')
    const b = make('onSubmit')
    type(b.input, 'a')
    blur(b.input)
    expect(errorOf(b.el, 'name')).toBe('')
    submit(b.el)
    expect(errorOf(b.el, 'name')).toContain('Минимум')
    const c = make('onBlur')
    type(c.input, 'a')
    expect(errorOf(c.el, 'name')).toBe('')
    blur(c.input)
    expect(errorOf(c.el, 'name')).toContain('Минимум')
  })

  it('неизвестный режим — понятная ошибка', () => {
    expect(() => form(html('<form data-form-mode="lazy"></form>'))).toThrow(/onTouched/)
  })
})

describe('form: схема', () => {
  const schema = s.object({
    email: s.string().email(),
    password: s.string().min(8),
    confirm: s.string().equals('password', 'Пароли не совпадают'),
    services: s.array().min(1, 'Выберите услугу'),
    agree: s.boolean().isTrue('Нужно согласие'),
  })
  const MARKUP = `<form data-form-schema="signup">
    <label class="field"><input name="email"></label>
    <label class="field"><input name="password"></label>
    <label class="field"><input name="confirm"></label>
    <fieldset><input type="checkbox" name="services[]" value="seo"><input type="checkbox" name="services[]" value="ads"></fieldset>
    <label class="field"><input type="checkbox" name="agree"></label>
    <label class="field"><input name="comment" maxlength="5"></label>
    <p data-form-status></p>
  </form>`

  it('схема по имени из registerSchema: ошибки всех полей, группа чекбоксов — одна ошибка на fieldset', () => {
    registerSchema('signup', schema)
    const el = html(MARKUP)
    const api = form(el)
    submit(el)
    expect(api.errors).toEqual({
      email: 'Заполните поле',
      password: 'Заполните поле',
      confirm: 'Заполните поле',
      services: 'Выберите услугу',
      agree: 'Нужно согласие',
    })
    expect(el.querySelector('fieldset [data-form-error]').textContent).toBe('Выберите услугу')
  })

  it('«Пароли не совпадают» исчезает, когда поправили ПЕРВОЕ поле', () => {
    const el = html(MARKUP.replace('data-form-schema="signup"', ''))
    const api = form(el, { options: { schema } })
    const [, pass, confirm] = el.querySelectorAll('input')
    type(pass, '12345678')
    type(confirm, '1234567')
    blur(confirm)
    expect(api.errors.confirm).toBe('Пароли не совпадают')
    type(pass, '1234567') // теперь совпадают — ошибка у confirm должна уйти
    expect(api.errors.confirm).toBeUndefined()
  })

  it('onSubmit из JS получает приведённые данные; ошибки, брошенные из onSubmit, — под полями', async () => {
    const onSubmit = vi.fn(async () => {
      throw Object.assign(new Error('x'), { errors: { email: 'Такой e-mail уже зарегистрирован' } })
    })
    const el = html(MARKUP.replace('data-form-schema="signup"', ''))
    const api = form(el, { options: { schema, onSubmit } })
    const inputs = el.querySelectorAll('input')
    type(inputs[0], 'a@b.ru')
    type(inputs[1], '12345678')
    type(inputs[2], '12345678')
    inputs[3].checked = true
    inputs[5].checked = true
    submit(el)
    await tick(5)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ email: 'a@b.ru', services: ['seo'], agree: true })
    expect(api.errors.email).toBe('Такой e-mail уже зарегистрирован')
    expect(document.activeElement).toBe(inputs[0])
  })

  it('zod-подобная схема (error.issues) тоже понимается', () => {
    const zodLike = {
      safeParse: (v) =>
        v.email
          ? { success: true, data: v }
          : { success: false, error: { issues: [{ path: ['email'], message: 'Нужен e-mail' }] } },
    }
    const el = html(`<form><label class="field"><input name="email"></label></form>`)
    const api = form(el, { options: { schema: zodLike } })
    submit(el)
    expect(api.errors.email).toBe('Нужен e-mail')
  })
})

describe('form: отправка', () => {
  it('ajax: блокировка кнопки, успех, reset сохраняет «Спасибо»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ message: 'Готово' }) })),
    )
    const el =
      html(`<form data-form-ajax action="/api"><label class="field"><input name="phone" data-mask="phone"></label>
      <button type="submit">go</button><p data-form-status></p></form>`)
    form(el)
    type(el.querySelector('input'), '9123456789')
    const success = vi.fn()
    el.addEventListener('form:success', success)
    submit(el)
    expect(el.querySelector('button').disabled).toBe(true)
    await tick(10)
    expect(success).toHaveBeenCalled()
    expect(el.querySelector('[data-form-status]').textContent).toBe('Готово')
    expect(el.querySelector('button').disabled).toBe(false)
  })

  it('ошибки сервера (Laravel-формат) — под полями; сеть упала — общий статус', async () => {
    expect(serverErrors({ errors: { phone: ['Занят', 'ещё'] } })).toEqual({ phone: 'Занят' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ errors: { name: ['Имя занято'] } }) })),
    )
    const el = html(
      `<form data-form-ajax action="/api"><label class="field"><input name="name"></label><p data-form-status></p></form>`,
    )
    const api = form(el)
    submit(el)
    await tick(10)
    expect(api.errors.name).toBe('Имя занято')
    // Уход с поля без изменений не стирает ошибку сервера; изменение — стирает.
    const input = el.querySelector('input')
    blur(input)
    expect(api.errors.name).toBe('Имя занято')
    type(input, 'Другое')
    expect(api.errors.name).toBeUndefined()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )
    submit(el)
    await tick(10)
    expect(el.querySelector('[data-form-status]').textContent).toContain('Не удалось отправить')
  })

  it('form:submit можно отменить; без ajax верная форма уходит браузеру', () => {
    const el = html(`<form><input name="a" value="1"></form>`)
    form(el)
    expect(submit(el).defaultPrevented).toBe(false)
    el.addEventListener('form:submit', (e) => e.preventDefault())
    expect(submit(el).defaultPrevented).toBe(true)
  })

  it('reset очищает ошибки и шлёт change полям', async () => {
    const el = html(`<form><label class="field"><input name="a" required></label></form>`)
    const api = form(el)
    submit(el)
    const change = vi.fn()
    el.querySelector('input').addEventListener('change', change)
    el.reset()
    await tick()
    expect(api.errors).toEqual({})
    expect(el.querySelector('input').getAttribute('aria-invalid')).toBe('false')
    expect(change).toHaveBeenCalled()
  })
})

describe('модули полей', () => {
  it('mask: на отдельном поле; без маски — ошибка', () => {
    const input = html('<input data-mask="date">')
    const api = mask(input)
    type(input, '01022025')
    expect(input.value).toBe('01.02.2025')
    api.destroy()
    expect(() => mask(html('<input>'))).toThrow(/data-mask/)
  })

  it('pickFiles: дубликаты, тип, размер, количество', () => {
    const a = new File(['1'], 'a.png', { type: 'image/png' })
    const pdf = new File(['1'], 'b.pdf', { type: 'application/pdf' })
    expect(pickFiles([a], [a]).accepted).toEqual([])
    const typed = pickFiles([], [a, pdf], { accept: ['image/*'] })
    expect(typed.accepted).toEqual([a])
    expect(typed.errors[0]).toContain('b.pdf')
    const big = Object.defineProperty(new File(['1'], 'big.png', { type: 'image/png' }), 'size', {
      value: 3 * 1024 * 1024,
    })
    expect(pickFiles([], [big], { maxSize: 2 }).errors[0]).toBe('«big.png» больше 2 МБ')
    expect(pickFiles([a], [pdf], { maxFiles: 1 }).errors[0]).toContain('не больше 1 файла')
  })

  it('file-upload: добавляет к списку (а не заменяет), удаляет, перетаскивание, reset', async () => {
    const root = html(`<form><div data-module="file-upload" data-file-upload-max-files="3">
      <input type="file" name="files" multiple><label class="upload__zone">zone <small data-file-upload-hint></small></label>
      <ul data-file-upload-list></ul></div></form>`)
    const upload = root.querySelector('[data-module]')
    const api = fileUpload(upload)
    expect(upload.querySelector('[data-file-upload-hint]').textContent).toBe('не больше 3 шт.')
    api.add([new File(['1'], 'a.txt')])
    api.add([new File(['2'], 'b.txt')])
    expect(api.files.map((f) => f.name)).toEqual(['a.txt', 'b.txt'])
    expect(upload.querySelectorAll('.upload__item')).toHaveLength(2)
    expect(upload.classList.contains('has-files')).toBe(true)
    upload.querySelector('.upload__remove').click()
    expect(api.files.map((f) => f.name)).toEqual(['b.txt'])
    const zone = upload.querySelector('.upload__zone')
    zone.dispatchEvent(new Event('dragenter'))
    expect(upload.classList.contains('is-dragover')).toBe(true)
    const drop = new Event('drop', { cancelable: true })
    drop.dataTransfer = { files: [new File(['3'], 'c.txt')] }
    zone.dispatchEvent(drop)
    expect(api.files).toHaveLength(2)
    expect(upload.classList.contains('is-dragover')).toBe(false)
    root.reset()
    await tick()
    expect(api.files).toHaveLength(0)
    api.destroy()
  })

  it('file-upload: превью создаются и освобождаются (без утечки памяти)', () => {
    const create = vi.fn(() => 'blob:1')
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(globalThis.URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const root = html('<div><input type="file" multiple><ul data-file-upload-list></ul></div>')
    const api = fileUpload(root)
    api.add([new File(['1'], 'a.png', { type: 'image/png' })])
    expect(root.querySelector('.upload__preview').getAttribute('src')).toBe('blob:1')
    api.destroy()
    expect(revoke).toHaveBeenCalledWith('blob:1')
  })

  it('password: переключение, aria, возврат в password перед отправкой', () => {
    const f = html('<form><div><input type="password" name="p"><button data-password-toggle></button></div></form>')
    const root = f.firstElementChild
    password(root)
    const [input, button] = [root.querySelector('input'), root.querySelector('button')]
    button.click()
    expect(input.type).toBe('text')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-label')).toBe('Скрыть пароль')
    f.dispatchEvent(new Event('submit'))
    expect(input.type).toBe('password')
  })

  it('char-counter: счёт, предупреждение у лимита, ошибка без лимита', () => {
    const field = html('<div><textarea maxlength="10"></textarea></div>').firstElementChild
    const api = charCounter(field)
    type(field, '123456789')
    const counter = field.parentElement.querySelector('.field__counter')
    expect(counter.textContent).toBe('9 / 10')
    expect(counter.classList.contains('is-near')).toBe(true)
    expect(field.parentElement.querySelector('[aria-live]').textContent).toBe('Остался 1 символ')
    api.destroy()
    expect(field.parentElement.querySelector('.field__counter')).toBeNull()
    expect(() => charCounter(html('<textarea></textarea>'))).toThrow(/maxlength/)
  })

  it('stepper: шаг без хвостов 0.30000000004, границы, события', () => {
    expect(stepValue(0.2, 1, { step: 0.1 })).toBe(0.3)
    expect(stepValue(10, 1, { max: 10 })).toBe(10)
    expect(stepValue(NaN, 1, { min: 1 })).toBe(2)
    const root = html(
      `<div><button data-stepper-dec>-</button><input type="number" value="1" min="1" max="3"><button data-stepper-inc>+</button></div>`,
    )
    const api = stepper(root)
    const input = root.querySelector('input')
    const change = vi.fn()
    input.addEventListener('change', change)
    expect(root.querySelector('[data-stepper-dec]').disabled).toBe(true)
    api.increment()
    api.increment()
    api.increment()
    expect(input.value).toBe('3')
    expect(root.querySelector('[data-stepper-inc]').disabled).toBe(true)
    expect(change).toHaveBeenCalledTimes(2)
    input.value = '99'
    input.dispatchEvent(new Event('blur'))
    expect(input.value).toBe('3')
  })

  it('autosize: CSS field-sizing, если есть; иначе высота по содержимому', () => {
    const a = html('<textarea></textarea>')
    vi.stubGlobal('CSS', { supports: () => true, escape: (s) => s })
    autosize(a).destroy()
    expect(a.classList.contains('is-autosize')).toBe(false)
    vi.stubGlobal('CSS', { supports: () => false, escape: (s) => s })
    const b = html('<textarea></textarea>')
    Object.defineProperty(b, 'scrollHeight', { value: 120 })
    autosize(b)
    expect(b.style.height).toBe('120px')
  })

  it('kit-ctx: форма шлёт form:success в шину', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    )
    const ctx = createCtx()
    const got = vi.fn()
    ctx.bus.on('form:success', got)
    const el = html('<form data-form-ajax action="/api"><input name="a" value="1"></form>')
    form(el, ctx)
    submit(el)
    await tick(10)
    expect(got).toHaveBeenCalled()
  })
})
