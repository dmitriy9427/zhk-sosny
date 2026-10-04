/**
 * Переводы (i18n): тексты интерфейса на нескольких языках.
 *
 *   import { t, addMessages, setLocale } from 'kit/js/core/i18n.js'
 *
 *   addMessages('ru', { cart: { add: 'В корзину', items: { one: '{count} товар', few: '{count} товара', many: '{count} товаров' } } })
 *   addMessages('en', { cart: { add: 'Add to cart', items: { one: '{count} item', other: '{count} items' } } })
 *
 *   t('cart.add')                  // 'В корзину'
 *   t('cart.items', { count: 3 })  // '3 товара' — склонение по правилам языка
 *   setLocale('en')                // все data-i18n на странице и тексты кита — по-английски
 *
 * ─── Откуда берётся язык ────────────────────────────────────────────────────
 * Из <html lang="…">. Это правильно и для SEO: у каждой языковой версии сайта
 * свой адрес (/ и /en/) и свой lang, поисковик индексирует обе.
 * setLocale() меняет язык «на лету» — для приложений и личных кабинетов;
 * выбор запоминается (localStorage) только при { remember: true }.
 *
 * ─── Тексты кита ─────────────────────────────────────────────────────────────
 * Сообщения модулей (ошибки форм, подписи кнопок, «Ничего не найдено» у
 * селекта) лежат в kit/js/i18n/ru.js и en.js под ключами kit.*. Свой язык —
 * addMessages('de', {...}) с теми же ключами; поправить текст кита —
 * addMessages('ru', { kit: { form: { invalid: 'Ой, проверьте поля' } } }).
 *
 * ─── Склонения ───────────────────────────────────────────────────────────────
 * Значение-объект { one, few, many, other } выбирается через Intl.PluralRules:
 * в русском 1 → one, 2–4 → few, 5–20 → many; в английском только one/other.
 * Не нашлось нужной формы — берётся other, потом many.
 * @module kit/core/i18n
 */
import ru from '../i18n/ru.js'
import en from '../i18n/en.js'
import { readStorage, writeStorage } from './storage.js'

const STORAGE_KEY = 'locale'
/** @type {Map<string, Record<string, any>>} */
const dictionaries = new Map()
dictionaries.set('ru', structuredClone(ru))
dictionaries.set('en', structuredClone(en))
const listeners = new Set()
let locale = null
/** Язык, из которого берётся текст, если в текущем ключа нет. */
let fallbackLocale = 'ru'

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v)
const isPlural = (v) => isObject(v) && ['one', 'few', 'many', 'other'].some((k) => typeof v[k] === 'string')

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (isObject(value) && !isPlural(value) && isObject(target[key])) merge(target[key], value)
    else target[key] = value
  }
  return target
}

/** Короткий код языка: 'ru-RU' → 'ru'. */
const short = (code) =>
  String(code || '')
    .toLowerCase()
    .split('-')[0]

/** Текущий язык: выбранный → <html lang> → 'ru'. */
export function getLocale() {
  if (locale) return locale
  const fromHtml = typeof document !== 'undefined' ? short(document.documentElement.lang) : ''
  return dictionaries.has(fromHtml) ? fromHtml : fallbackLocale
}

/** Языки, для которых есть словари. */
export const getLocales = () => [...dictionaries.keys()]

/**
 * Добавить/переопределить тексты языка (сливаются со словарём).
 * @param {string} code 'ru', 'en', 'de'…
 * @param {object} messages
 */
export function addMessages(code, messages) {
  const key = short(code)
  if (!dictionaries.has(key)) dictionaries.set(key, {})
  merge(dictionaries.get(key), messages)
}

/** Язык, на который откатываться, если ключа нет в текущем. */
export function setFallbackLocale(code) {
  fallbackLocale = short(code)
}

const lookup = (code, key) =>
  key.split('.').reduce((node, part) => (isObject(node) ? node[part] : undefined), dictionaries.get(code))

/**
 * Перевести ключ. Параметры подставляются в {имя}; count выбирает форму склонения.
 * Нет перевода — ключ возвращается как есть (и предупреждение в разработке):
 * на странице видно «cart.add», а не пустое место.
 * @param {string} key 'kit.form.required'
 * @param {Record<string, any>} [params]
 */
export function t(key, params = {}) {
  const code = getLocale()
  let value = lookup(code, key) ?? lookup(fallbackLocale, key)
  if (value === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] нет перевода «${key}» (${code})`)
    return key
  }
  if (isPlural(value)) {
    const form = new Intl.PluralRules(code).select(Number(params.count ?? 0))
    value = value[form] ?? value.other ?? value.many ?? value.one
  }
  return String(value).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

/** Есть ли перевод ключа (в текущем языке или запасном). */
export const hasMessage = (key) => lookup(getLocale(), key) !== undefined || lookup(fallbackLocale, key) !== undefined

/**
 * Перевести элементы страницы:
 *   <h1 data-i18n="hero.title">Заголовок</h1>
 *   <input data-i18n-attr="placeholder:search.placeholder, aria-label:search.label">
 *   <p data-i18n="cart.items" data-i18n-count="3">…</p>
 *   <p data-i18n-html="legal.consent">…</p>   ← перевод с разметкой (только доверенный текст!)
 * Исходный текст в HTML — запасной вариант для поисковиков и без JS.
 */
/** @param {ParentNode} [root] */
export function translatePage(root = document) {
  /** @type {(selector: string) => HTMLElement[]} */
  const scope = (selector) => [
    ...(root instanceof Element && root.matches(selector) ? [/** @type {HTMLElement} */ (root)] : []),
    ...root.querySelectorAll(/** @type {any} */ (selector)),
  ]
  const params = (el) => ({ ...(el.dataset.i18nCount ? { count: Number(el.dataset.i18nCount) } : {}) })
  scope('[data-i18n]').forEach((el) => {
    if (hasMessage(el.dataset.i18n)) el.textContent = t(el.dataset.i18n, params(el))
  })
  scope('[data-i18n-html]').forEach((el) => {
    if (hasMessage(el.dataset.i18nHtml)) el.innerHTML = t(el.dataset.i18nHtml, params(el))
  })
  scope('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim())
      if (attr && key && hasMessage(key)) el.setAttribute(attr, t(key))
    }
  })
}

/**
 * Сменить язык: <html lang>, перевод страницы, событие для модулей.
 * @param {string} code
 * @param {{ remember?: boolean }} [o] remember — запомнить выбор пользователя.
 */
export function setLocale(code, { remember = false } = {}) {
  const next = short(code)
  if (!dictionaries.has(next)) throw new Error(`[i18n] нет словаря «${next}». Есть: ${getLocales().join(', ')}`)
  locale = next
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next
    translatePage()
    document.dispatchEvent(new CustomEvent('locale:change', { detail: { locale: next } }))
  }
  if (remember) writeStorage(STORAGE_KEY, next)
  listeners.forEach((fn) => fn(next))
}

/** Применить запомненный выбор пользователя (если был). */
export function restoreLocale() {
  const saved = readStorage(STORAGE_KEY)
  if (saved && dictionaries.has(saved) && saved !== getLocale()) setLocale(saved)
}

/** Подписаться на смену языка. @returns {() => void} */
export function onLocaleChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Сбросить состояние (тесты). */
export function resetLocale() {
  locale = null
  fallbackLocale = 'ru'
}

/** Сообщение «лениво»: текст берётся в момент показа, а не при создании схемы. */
/**
 * @param {string} key
 * @param {Record<string, any>} [params]
 * @returns {string | (() => string)} — функция; тип шире, чтобы свой текст можно было передать строкой
 */
export const lazyT = (key, params) => () => t(key, params)
