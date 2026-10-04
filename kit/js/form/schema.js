/**
 * Схемы проверки данных в стиле zod — без зависимостей, с русскими текстами.
 *
 *   import { s } from 'kit/js/form/schema.js'
 *
 *   const callbackSchema = s.object({
 *     name: s.string().trim().min(2),
 *     phone: s.string().phone(),
 *     email: s.string().email().optional(),
 *     age: s.number().int().min(18, 'Только для взрослых'),
 *     birthday: s.date().minAge(18),
 *     topic: s.enum(['site', 'support']),
 *     services: s.array().min(1, 'Выберите хотя бы одну услугу'),
 *     files: s.files().max(3).maxSize(5 * 1024 * 1024).accept(['image/*', '.pdf']).optional(),
 *     password: s.string().min(8).regex(/\d/, 'Нужна хотя бы одна цифра'),
 *     confirm: s.string().equals('password', 'Пароли не совпадают'),
 *     consent: s.boolean().isTrue('Нужно ваше согласие'),
 *   })
 *
 *   const result = callbackSchema.safeParse(data)
 *   result.success  // true/false
 *   result.data     // приведённые значения: '25' → 25, 'on' → true, '' → undefined
 *   result.errors   // { phone: 'Введите номер полностью', … } — первая ошибка поля
 *
 * ─── Чем похоже на zod и чем отличается ─────────────────────────────────────
 * Похоже: цепочки .min().max(), .optional(), .default(), .refine(),
 * .transform(), safeParse/parse, схема — обычный объект, её можно вынести в
 * отдельный файл и использовать и на фронте, и (в Node) на бэкенде.
 * Отличия — под формы: значения приходят строками из полей, поэтому
 * number/date/boolean сами приводят строку (как z.coerce); пустая строка —
 * это «не заполнено»; ошибки сразу плоским объектом «поле → текст».
 * Если в проекте уже есть zod — модуль form примет и zod-схему (см. README).
 *
 * Каждый метод возвращает НОВУЮ схему (неизменяемость, как в zod): общую
 * базу можно переиспользовать — const phone = s.string().phone().
 * @module kit/form/schema
 */

// ─── Тексты ошибок ───────────────────────────────────────────────────────────
// Тексты по умолчанию — в словарях kit/js/i18n (ru, en). Сообщение хранится
// как функция и превращается в текст В МОМЕНТ ПОКАЗА — поэтому схема,
// созданная при загрузке страницы, говорит на языке, выбранном позже.
// Свой текст можно передать строкой или функцией: .min(2, () => t('my.key')).
import { getLocale, lazyT, t } from '../core/i18n.js'

/** @typedef {string | (() => string)} Message Текст ошибки: строка или функция (для переводов). */

/** Текст сообщения: строка как есть, функция — вызвать. */
export const resolveMessage = (message) => (typeof message === 'function' ? message() : message)

/** Склонение по-русски: plural(5, ['символ', 'символа', 'символов']) → 'символов'.
 *  (Для переводов используйте формы { one, few, many } в словаре — t() склоняет сам.) */
export function plural(n, [one, few, many]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
/** Размер файла по-человечески: 5242880 → «5 МБ» (на текущем языке). */
export const formatSize = (bytes) =>
  bytes >= 1024 ** 2
    ? t('kit.size.mb', { value: +(bytes / 1024 ** 2).toFixed(1) })
    : t('kit.size.kb', { value: Math.ceil(bytes / 1024) })

/** Пустое значение = «поле не заполнено». */
export const isEmpty = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

// ─── Контрольные суммы российских номеров ───────────────────────────────────
/** ИНН (10 цифр — организация, 12 — человек/ИП) с проверкой контрольных цифр. */
export function isValidInn(value) {
  const d = String(value).replace(/\D/g, '')
  const check = (weights) => (weights.reduce((sum, w, i) => sum + w * Number(d[i]), 0) % 11) % 10
  if (d.length === 10) return check([2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(d[9])
  if (d.length === 12) {
    return (
      check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(d[10]) &&
      check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(d[11])
    )
  }
  return false
}

/** СНИЛС (11 цифр) с проверкой контрольного числа. */
export function isValidSnils(value) {
  const d = String(value).replace(/\D/g, '')
  if (d.length !== 11) return false
  const sum = [...d.slice(0, 9)].reduce((acc, c, i) => acc + Number(c) * (9 - i), 0)
  const control = sum < 100 ? sum : sum === 100 || sum === 101 ? 0 : sum % 101 === 100 ? 0 : sum % 101
  return control === Number(d.slice(9))
}

/** 'ДД.ММ.ГГГГ' или 'ГГГГ-ММ-ДД' (input type=date) → Date или null. */
export function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = String(value).trim()
  let m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  let y
  let mo
  let da
  if (m) [, da, mo, y] = m
  else if ((m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [, y, mo, da] = m
  else return null
  const date = new Date(Number(y), Number(mo) - 1, Number(da))
  // 31.02.2024 JS «исправит» на 2 марта — такую дату считаем неверной.
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(da))
    return null
  return date
}

const toDate = (v) => (v === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)) : parseDate(v))
const fmtDate = (d) => d.toLocaleDateString(getLocale())

// ─── База всех схем ─────────────────────────────────────────────────────────
/** «Не удалось привести к типу» — например, «abc» для числа. */
class Invalid {
  constructor(error) {
    this.error = error
  }
}
const invalid = (error) => new Invalid(error)

class Schema {
  constructor(type, coerce, requiredMessage = lazyT('kit.schema.required')) {
    this.type = type
    this._coerce = coerce // строка из поля → значение нужного типа (или { error })
    this._checks = [] // [(value, all) => текст ошибки | '']
    this._transforms = []
    this._optional = false
    this._default = undefined
    this._required = requiredMessage
  }

  _with(patch) {
    const next = Object.assign(Object.create(Object.getPrototypeOf(this)), this, patch)
    next._checks = patch._checks ?? [...this._checks]
    next._transforms = patch._transforms ?? [...this._transforms]
    return next
  }

  /** Добавить проверку: fn(value, всеДанные) → true, если всё хорошо. */
  refine(fn, message = lazyT('kit.schema.invalid')) {
    return this._with({ _checks: [...this._checks, (v, all) => (fn(v, all) ? '' : resolveMessage(message))] })
  }

  /** Поле можно не заполнять. Если заполнено — проверяется как обычно. */
  optional() {
    return this._with({ _optional: true })
  }

  /** Значение, если поле пустое (поле становится необязательным). */
  default(value) {
    return this._with({ _optional: true, _default: value })
  }

  /** Свой текст для «не заполнено». */
  required(message) {
    return this._with({ _required: message })
  }

  /** Преобразовать значение после проверок: .transform((v) => v.toUpperCase()). */
  transform(fn) {
    return this._with({ _transforms: [...this._transforms, fn] })
  }

  /**
   * Проверить одно значение.
   * @returns {{ success: true, data: any } | { success: false, error: string }}
   */
  safeParse(raw, all = {}) {
    if (isEmpty(raw) && this.type !== 'boolean') {
      if (this._optional) return { success: true, data: this._default }
      return { success: false, error: resolveMessage(this._required) }
    }
    const coerced = this._coerce(raw)
    if (coerced instanceof Invalid) return { success: false, error: resolveMessage(coerced.error) }
    for (const check of this._checks) {
      const error = check(coerced, all)
      if (error) return { success: false, error }
    }
    return { success: true, data: this._transforms.reduce((v, fn) => fn(v), coerced) }
  }

  parse(raw, all) {
    const result = this.safeParse(raw, all)
    if (result.success === false) throw new ValidationError({ _: result.error })
    return result.data
  }
}

// ─── Строка ─────────────────────────────────────────────────────────────────
class StringSchema extends Schema {
  constructor() {
    super('string', (v) => String(v))
  }
  /** Убрать пробелы по краям (до проверок). */
  trim() {
    return this._with({ _coerce: (v) => String(v).trim() })
  }
  min(n, message = lazyT('kit.schema.minChars', { count: n })) {
    return this.refine((v) => v.length >= n, message)
  }
  max(n, message = lazyT('kit.schema.maxChars', { count: n })) {
    return this.refine((v) => v.length <= n, message)
  }
  length(n, message = lazyT('kit.schema.exactChars', { count: n })) {
    return this.refine((v) => v.length === n, message)
  }
  regex(re, message = lazyT('kit.schema.format')) {
    return this.refine((v) => re.test(v), message)
  }
  email(message = lazyT('kit.schema.email')) {
    // Не RFC целиком (он разрешает почти всё), а то, что реально опечатка.
    return this.regex(/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/, message)
  }
  url(message = lazyT('kit.schema.url')) {
    return this.regex(/^https?:\/\/[^\s.]+\.[^\s]{2,}/, message)
  }
  /** Российский номер: 11 цифр с 7 или 8 в начале (маска phone даёт ровно такой). */
  phone(message = lazyT('kit.schema.phone')) {
    return this.refine((v) => /^[78]\d{10}$/.test(v.replace(/\D/g, '')), message)
  }
  inn(message = lazyT('kit.schema.inn')) {
    return this.refine(isValidInn, message)
  }
  snils(message = lazyT('kit.schema.snils')) {
    return this.refine(isValidSnils, message)
  }
  /** Совпадает с другим полем: s.string().equals('password', 'Пароли не совпадают'). */
  equals(field, message = lazyT('kit.schema.equals')) {
    return this.refine((v, all) => v === String(all[field] ?? ''), message)
  }
}

// ─── Число (строка из поля приводится сама) ────────────────────────────────
class NumberSchema extends Schema {
  constructor() {
    super('number', (v) => {
      const n =
        typeof v === 'number'
          ? v
          : Number(
              String(v)
                .replace(/[\s\u00a0]/g, '')
                .replace(',', '.'),
            )
      return Number.isFinite(n) ? n : invalid(lazyT('kit.schema.number'))
    })
  }
  min(n, message = lazyT('kit.schema.min', { min: n })) {
    return this.refine((v) => v >= n, message)
  }
  max(n, message = lazyT('kit.schema.max', { max: n })) {
    return this.refine((v) => v <= n, message)
  }
  int(message = lazyT('kit.schema.int')) {
    return this.refine(Number.isInteger, message)
  }
  positive(message = lazyT('kit.schema.positive')) {
    return this.refine((v) => v > 0, message)
  }
}

// ─── Флажок ─────────────────────────────────────────────────────────────────
class BooleanSchema extends Schema {
  constructor() {
    super('boolean', (v) => v === true || v === 'on' || v === 'true' || v === '1')
  }
  /** Обязан быть отмечен (согласие на обработку данных). */
  isTrue(message = lazyT('kit.schema.checked')) {
    return this.refine((v) => v === true, message)
  }
}

// ─── Дата ───────────────────────────────────────────────────────────────────
class DateSchema extends Schema {
  constructor() {
    super('date', (v) => parseDate(v) ?? invalid(lazyT('kit.schema.date')))
  }
  /** Не раньше даты ('today' — сегодня). */
  min(date, message) {
    const limit = toDate(date)
    return this.refine((v) => v >= limit, message ?? (() => t('kit.schema.dateMin', { date: fmtDate(limit) })))
  }
  max(date, message) {
    const limit = toDate(date)
    return this.refine((v) => v <= limit, message ?? (() => t('kit.schema.dateMax', { date: fmtDate(limit) })))
  }
  /** Возраст не меньше N лет на сегодня. */
  minAge(years, message = lazyT('kit.schema.minAge', { count: years })) {
    return this.refine((v) => {
      const now = new Date()
      const limit = new Date(now.getFullYear() - years, now.getMonth(), now.getDate())
      return v <= limit
    }, message)
  }
}

// ─── Выбор из списка ────────────────────────────────────────────────────────
class EnumSchema extends Schema {
  constructor(values, message = lazyT('kit.schema.choose')) {
    super('enum', (v) => (values.includes(v) ? v : invalid(message)), message)
    this.values = values
  }
}

// ─── Список значений (группа чекбоксов, select multiple) ────────────────────
class ArraySchema extends Schema {
  constructor(item) {
    super('array', (v) => (Array.isArray(v) ? v : [v]), lazyT('kit.schema.chooseAny'))
    if (item) {
      this._checks.push((list, all) => {
        for (const value of list) {
          const result = item.safeParse(value, all)
          if (!result.success) return result.error
        }
        return ''
      })
    }
  }
  // Пустой список — это и «не заполнено», и «меньше min»: показываем текст min.
  min(n, message = lazyT('kit.schema.chooseMin', { count: n })) {
    return this._with({ _required: message }).refine((v) => v.length >= n, message)
  }
  max(n, message = lazyT('kit.schema.chooseMax', { count: n })) {
    return this.refine((v) => v.length <= n, message)
  }
}

// ─── Файлы ──────────────────────────────────────────────────────────────────
/** Подходит ли файл под accept: 'image/*', 'application/pdf', '.docx'. */
export function matchesAccept(file, accept) {
  const name = file.name.toLowerCase()
  return accept.some((rule) => {
    const r = rule.trim().toLowerCase()
    if (r.startsWith('.')) return name.endsWith(r)
    if (r.endsWith('/*')) return file.type.startsWith(r.slice(0, -1))
    return file.type === r
  })
}

class FilesSchema extends Schema {
  constructor() {
    super(
      'files',
      (v) => Array.from(v?.length !== undefined && typeof v !== 'string' ? v : [v]),
      lazyT('kit.schema.fileRequired'),
    )
  }
  min(n, message = lazyT('kit.schema.filesMin', { count: n })) {
    return this._with({ _required: message }).refine((v) => v.length >= n, message)
  }
  max(n, message = lazyT('kit.schema.filesMax', { count: n })) {
    return this.refine((v) => v.length <= n, message)
  }
  /** Максимальный размер ОДНОГО файла в байтах. */
  maxSize(bytes, message) {
    return this._with({
      _checks: [
        ...this._checks,
        (files) => {
          const big = files.find((f) => f.size > bytes)
          return big
            ? (resolveMessage(message) ?? t('kit.schema.fileSize', { name: big.name, size: formatSize(bytes) }))
            : ''
        },
      ],
    })
  }
  /** Разрешённые типы: ['image/*', '.pdf']. */
  accept(list, message) {
    return this._with({
      _checks: [
        ...this._checks,
        (files) => {
          const bad = files.find((f) => !matchesAccept(f, list))
          return bad
            ? (resolveMessage(message) ?? t('kit.schema.fileType', { name: bad.name, types: list.join(', ') }))
            : ''
        },
      ],
    })
  }
}

// ─── Объект (вся форма) ─────────────────────────────────────────────────────
export class ValidationError extends Error {
  constructor(errors) {
    super(Object.values(errors)[0] ?? 'Ошибка проверки')
    this.errors = errors
  }
}

class ObjectSchema {
  constructor(shape, refinements = []) {
    this.type = 'object'
    this.shape = shape
    this._refinements = refinements
  }

  /**
   * Проверка нескольких полей вместе. path — поле, под которым показать ошибку.
   *   .refine((d) => !d.from || !d.to || d.from <= d.to, { path: 'to', message: 'Дата «по» раньше даты «с»' })
   * @param {(data: Record<string, any>, raw: Record<string, any>) => boolean} fn
   * @param {{ path?: string, message?: Message }} [options]
   */
  refine(fn, { path, message = lazyT('kit.schema.invalid') } = {}) {
    return new ObjectSchema(this.shape, [...this._refinements, { fn, path, message }])
  }

  /** Схема без части полей / с дополнительными полями — как zod .omit/.extend. */
  omit(keys) {
    const shape = { ...this.shape }
    keys.forEach((k) => delete shape[k])
    return new ObjectSchema(shape, this._refinements)
  }
  extend(shape) {
    return new ObjectSchema({ ...this.shape, ...shape }, this._refinements)
  }

  /**
   * @param {Record<string, any>} input Значения формы (см. formValues()).
   * @param {{ only?: string }} [o] only — проверить одно поле (при уходе с поля),
   *   но с учётом остальных данных (для equals и refine).
   */
  safeParse(input = {}, { only } = {}) {
    const data = {}
    const errors = {}
    for (const [key, schema] of Object.entries(this.shape)) {
      if (only && key !== only) continue
      const result = schema.safeParse(input[key], input)
      if (result.success) data[key] = result.data
      else errors[key] = result.error
    }
    for (const { fn, path, message } of this._refinements) {
      if (only && path !== only) continue
      if (path && errors[path]) continue // у поля уже есть своя ошибка — показываем её
      if (!fn({ ...input, ...data }, input)) errors[path ?? '_'] = resolveMessage(message)
    }
    const success = Object.keys(errors).length === 0
    return success ? { success, data, errors: {} } : { success, data, errors }
  }

  parse(input) {
    const result = this.safeParse(input)
    if (!result.success) throw new ValidationError(result.errors)
    return result.data
  }
}

/** Конструкторы схем — точка входа: s.string(), s.object({...}) … */
export const s = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  date: () => new DateSchema(),
  enum: (values, message) => new EnumSchema(values, message),
  array: (item) => new ArraySchema(item),
  files: () => new FilesSchema(),
  object: (shape) => new ObjectSchema(shape),
}
