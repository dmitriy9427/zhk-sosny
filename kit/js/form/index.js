/**
 * Всё для форм одним импортом:
 *   import { s, registerSchema, formValues, createMask } from 'kit/js/form'
 *
 * registerSchema — связать схему с формой из HTML по имени:
 *   // src/main.js
 *   registerSchema('callback', s.object({ … }))
 *   <!-- HTML -->
 *   <form data-module="form" data-form-schema="callback">
 * Схему из JS/React можно передать и напрямую: ctx.options.schema.
 * @module kit/form
 */
export {
  ValidationError,
  formatSize,
  isEmpty,
  isValidInn,
  isValidSnils,
  matchesAccept,
  parseDate,
  plural,
  s,
} from './schema.js'
export { MASKS, attachMask, createMask, createNumberMask, getMask, maskFor } from './mask.js'
export { fieldsByName, formValues } from './values.js'

const schemas = new Map()

/** Зарегистрировать схему под именем (для data-form-schema="имя"). */
export function registerSchema(name, schema) {
  if (typeof schema?.safeParse !== 'function')
    throw new Error(`[kit] registerSchema(«${name}»): нужна схема с методом safeParse`)
  schemas.set(name, schema)
}

export function getSchema(name) {
  const schema = schemas.get(name)
  if (!schema) {
    throw new Error(
      `[kit] нет схемы «${name}». Зарегистрируйте её до запуска: registerSchema('${name}', s.object({…}))`,
    )
  }
  return schema
}
