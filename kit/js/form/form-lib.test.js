import { describe, expect, it } from 'vitest'
import { ValidationError, isValidInn, isValidSnils, parseDate, plural, s } from './schema.js'
import { attachMask, createMask, createNumberMask, maskFor } from './mask.js'
import { formValues } from './values.js'
import { getSchema, registerSchema } from './index.js'
import { html } from '@test/helpers.js'

const file = (name, size = 10, type = '') => Object.assign(new File(['x'], name, { type }), { size })
Object.defineProperty(File.prototype, 'size', { configurable: true, writable: true, value: 1 })

describe('schema: поля', () => {
  it('string: обязательность, trim, min/max, email, phone, regex', () => {
    expect(s.string().safeParse('')).toEqual({ success: false, error: 'Заполните поле' })
    expect(s.string().required('Как вас зовут?').safeParse('  ').error).toBe('Как вас зовут?')
    expect(s.string().trim().min(2).safeParse(' a ').error).toBe('Минимум 2 символа')
    expect(s.string().max(3).safeParse('abcde').error).toBe('Максимум 3 символа')
    expect(s.string().min(5).safeParse('abc').error).toBe('Минимум 5 символов')
    expect(s.string().email().safeParse('a@b').success).toBe(false)
    expect(s.string().email().safeParse('ivan@mail.ru').success).toBe(true)
    expect(s.string().phone().safeParse('+7 (912) 345-67-89').success).toBe(true)
    expect(s.string().phone().safeParse('+7 (912) 345').error).toBe('Введите номер полностью')
    expect(s.string().regex(/\d/, 'Нужна цифра').safeParse('abc').error).toBe('Нужна цифра')
    expect(s.string().trim().safeParse('  x ').data).toBe('x')
  })

  it('optional, default, transform, refine', () => {
    expect(s.string().email().optional().safeParse('')).toEqual({ success: true, data: undefined })
    expect(s.string().email().optional().safeParse('bad').success).toBe(false) // заполнено — проверяется
    expect(s.number().default(1).safeParse('').data).toBe(1)
    expect(
      s
        .string()
        .transform((v) => v.toUpperCase())
        .safeParse('ab').data,
    ).toBe('AB')
    expect(
      s
        .string()
        .refine((v) => v !== 'admin', 'Имя занято')
        .safeParse('admin').error,
    ).toBe('Имя занято')
  })

  it('схемы неизменяемы: цепочка не портит базу', () => {
    const base = s.string()
    const strict = base.min(5)
    expect(base.safeParse('abc').success).toBe(true)
    expect(strict.safeParse('abc').success).toBe(false)
  })

  it('number приводит строку, ловит мусор, min/max/int/positive', () => {
    expect(s.number().safeParse('1 500,5').data).toBe(1500.5)
    expect(s.number().safeParse('abc').error).toBe('Введите число')
    expect(s.number().int().safeParse('1.5').error).toBe('Введите целое число')
    expect(s.number().min(18).safeParse('17').error).toBe('Не меньше 18')
    expect(s.number().max(10).safeParse('11').success).toBe(false)
    expect(s.number().positive().safeParse('0').success).toBe(false)
  })

  it('boolean: чекбокс; isTrue — для согласия', () => {
    expect(s.boolean().safeParse('on').data).toBe(true)
    expect(s.boolean().safeParse(undefined).data).toBe(false)
    expect(s.boolean().isTrue('Нужно согласие').safeParse(false).error).toBe('Нужно согласие')
  })

  it('date: ДД.ММ.ГГГГ и ГГГГ-ММ-ДД, несуществующие даты, min/max/minAge', () => {
    expect(parseDate('31.12.2025').getDate()).toBe(31)
    expect(parseDate('2025-12-31').getMonth()).toBe(11)
    expect(parseDate('31.02.2024')).toBeNull()
    expect(s.date().safeParse('99.99.9999').error).toContain('ДД.ММ.ГГГГ')
    expect(s.date().min('01.01.2025').safeParse('31.12.2024').error).toBe('Не раньше 01.01.2025')
    expect(s.date().max('today').safeParse('01.01.2999').success).toBe(false)
    const kid = new Date()
    kid.setFullYear(kid.getFullYear() - 10)
    expect(s.date().minAge(18).safeParse(kid.toLocaleDateString('ru-RU')).success).toBe(false)
  })

  it('enum, array, files', () => {
    expect(s.enum(['a', 'b']).safeParse('c').error).toBe('Выберите вариант')
    expect(s.enum(['a', 'b']).safeParse('').error).toBe('Выберите вариант')
    expect(s.array().safeParse([]).error).toBe('Выберите хотя бы один вариант')
    expect(s.array().max(1).safeParse(['a', 'b']).success).toBe(false)
    expect(s.array(s.enum(['a'])).safeParse(['a', 'z']).success).toBe(false)
    const big = file('big.png', 6 * 1024 * 1024, 'image/png')
    expect(s.files().safeParse([]).error).toBe('Прикрепите файл')
    expect(
      s
        .files()
        .maxSize(5 * 1024 * 1024)
        .safeParse([big]).error,
    ).toBe('«big.png» больше 5 МБ')
    expect(
      s
        .files()
        .accept(['.pdf'])
        .safeParse([file('a.png', 1, 'image/png')]).error,
    ).toContain('можно только .pdf')
    expect(
      s
        .files()
        .accept(['image/*'])
        .safeParse([file('a.png', 1, 'image/png')]).success,
    ).toBe(true)
    expect(
      s
        .files()
        .max(1)
        .safeParse([file('a'), file('b')]).error,
    ).toBe('Не больше 1 файла')
  })

  it('ИНН и СНИЛС с контрольными суммами', () => {
    expect(isValidInn('7707083893')).toBe(true) // Сбербанк
    expect(isValidInn('7707083894')).toBe(false)
    expect(isValidInn('500100732259')).toBe(true)
    expect(isValidSnils('112-233-445 95')).toBe(true)
    expect(isValidSnils('112-233-445 96')).toBe(false)
    expect(s.string().inn().safeParse('1234567890').success).toBe(false)
  })

  it('plural', () => {
    expect([1, 2, 5, 11, 21, 22].map((n) => plural(n, ['файл', 'файла', 'файлов']))).toEqual([
      'файл',
      'файла',
      'файлов',
      'файлов',
      'файл',
      'файла',
    ])
  })
})

describe('schema: объект (форма)', () => {
  const schema = s
    .object({
      name: s.string().trim().min(2),
      age: s.number().optional(),
      password: s.string().min(8),
      confirm: s.string().equals('password', 'Пароли не совпадают'),
      from: s.date().optional(),
      to: s.date().optional(),
    })
    .refine((d) => !d.from || !d.to || d.from <= d.to, { path: 'to', message: '«По» раньше «С»' })

  it('safeParse: данные приведены, ошибки — плоский объект', () => {
    const ok = schema.safeParse({ name: ' Иван ', age: '30', password: '12345678', confirm: '12345678' })
    expect(ok.success).toBe(true)
    expect(ok.data).toMatchObject({ name: 'Иван', age: 30 })
    const bad = schema.safeParse({ name: 'И', password: '1', confirm: '2', from: '10.01.2025', to: '01.01.2025' })
    expect(bad.errors).toEqual({
      name: 'Минимум 2 символа',
      password: 'Минимум 8 символов',
      confirm: 'Пароли не совпадают',
      to: '«По» раньше «С»',
    })
  })

  it('only — проверить одно поле (для проверки при уходе с поля)', () => {
    const result = schema.safeParse({ name: '', confirm: 'x', password: 'y' }, { only: 'confirm' })
    expect(result.errors).toEqual({ confirm: 'Пароли не совпадают' })
  })

  it('parse бросает ValidationError; omit/extend', () => {
    expect(() => schema.parse({})).toThrow(ValidationError)
    try {
      schema.parse({})
    } catch (error) {
      expect(error.errors.name).toBe('Заполните поле')
    }
    const short = schema.omit(['password', 'confirm']).extend({ email: s.string().email() })
    expect(Object.keys(short.shape)).toEqual(['name', 'age', 'from', 'to', 'email'])
  })

  it('registerSchema / getSchema', () => {
    registerSchema('t', schema)
    expect(getSchema('t')).toBe(schema)
    expect(() => getSchema('nope')).toThrow(/registerSchema\('nope'/)
    expect(() => registerSchema('x', {})).toThrow(/safeParse/)
  })
})

describe('mask', () => {
  it('phone: формат, вставка с 8/+7, стирание до префикса', () => {
    const phone = maskFor(html('<input data-mask="phone">'))
    expect(phone.format('9123456789')).toBe('+7 (912) 345-67-89')
    expect(phone.format('89123456789')).toBe('+7 (912) 345-67-89')
    expect(phone.format('+7 912 345 67 89')).toBe('+7 (912) 345-67-89')
    expect(phone.format('+7 (912) 3')).toBe('+7 (912) 3')
    expect(phone.format('+7 (')).toBe('')
    expect(phone.format('+7')).toBe('')
    expect(phone.unmask('+7 (912) 345-67-89')).toBe('9123456789')
    expect(phone.isComplete('+7 (912) 345-67-8')).toBe(false)
    expect(phone.isComplete('+7 (912) 345-67-89')).toBe(true)
  })

  it('date, snils, inn (10 или 12), свой шаблон с буквами', () => {
    expect(maskFor(html('<input data-mask="date">')).format('31122025')).toBe('31.12.2025')
    expect(maskFor(html('<input data-mask="snils">')).format('11223344595')).toBe('112-233-445 95')
    const inn = maskFor(html('<input data-mask="inn">'))
    expect(inn.isComplete('7707083893')).toBe(true)
    expect(inn.isComplete('77070838')).toBe(false)
    const custom = createMask('AA-999')
    expect(custom.format('ab123')).toBe('ab-123')
    expect(custom.format('1a2b345')).toBe('ab-345') // цифры на месте букв пропускаются
  })

  it('number: разряды, дробная часть, минус', () => {
    const n = createNumberMask({ decimals: 2 })
    expect(n.format('1500000,555')).toBe('1\u00a0500\u00a0000,55')
    expect(n.format('-1234.5')).toBe('-1\u00a0234,5')
    expect(n.unmask('1 500,5')).toBe('1500.5')
    expect(createNumberMask().format('12,34')).toBe('12')
  })

  it('неизвестная маска — предупреждение, null', () => {
    const warn = globalThis.console.warn
    let message = ''
    globalThis.console.warn = (m) => (message = m)
    expect(maskFor(html('<input data-mask="card">'))).toBeNull()
    globalThis.console.warn = warn
    expect(message).toContain('card')
  })

  it('attachMask: форматирует ввод, курсор после той же цифры, Backspace перескакивает дефис, повтор не дублирует', () => {
    const input = html('<input data-mask="phone">')
    const handle = attachMask(input)
    expect(attachMask(input)).toBe(handle)
    expect(input.inputMode).toBe('tel')
    input.focus()
    input.value = '9123456789'
    input.dispatchEvent(new Event('input'))
    expect(input.value).toBe('+7 (912) 345-67-89')
    // Правка в середине: курсор остаётся после вставленной цифры, а не уезжает в конец.
    input.value = '+7 (9152) 345-67-89'
    input.setSelectionRange(8, 8)
    input.dispatchEvent(new Event('input'))
    expect(input.value).toBe('+7 (915) 234-56-78')
    expect(input.selectionStart).toBe(10)
    // Backspace сразу после «-»: курсор перескакивает дефис, удаляться будет цифра.
    input.setSelectionRange(16, 16)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(input.selectionStart).toBe(15)
    handle.destroy()
  })
})

describe('formValues', () => {
  it('чекбоксы, группы, радио, select multiple, файлы, disabled', () => {
    const form = html(`<form>
      <input name="name" value="Иван">
      <input type="checkbox" name="consent" checked>
      <input type="checkbox" name="news">
      <input type="checkbox" name="services[]" value="seo" checked>
      <input type="checkbox" name="services[]" value="ads">
      <input type="checkbox" name="tags" value="a" checked><input type="checkbox" name="tags" value="b" checked>
      <input type="radio" name="size" value="s"><input type="radio" name="size" value="m" checked>
      <input type="radio" name="color" value="red">
      <select name="days" multiple><option selected>пн</option><option>вт</option><option selected>ср</option></select>
      <input type="file" name="files">
      <input name="off" value="x" disabled>
      <button name="go" value="1">ok</button>
    </form>`)
    expect(formValues(form)).toEqual({
      name: 'Иван',
      consent: true,
      news: false,
      services: ['seo'],
      tags: ['a', 'b'],
      size: 'm',
      color: '',
      days: ['пн', 'ср'],
      files: [],
    })
  })
})
