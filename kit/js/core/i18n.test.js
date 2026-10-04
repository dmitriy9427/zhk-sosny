import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addMessages,
  getLocale,
  hasMessage,
  lazyT,
  onLocaleChange,
  resetLocale,
  setLocale,
  t,
  translatePage,
} from './i18n.js'
import langSwitch from '../modules/lang-switch/index.js'
import { s } from '../form/schema.js'
import { html } from '@test/helpers.js'

afterEach(() => resetLocale())

describe('i18n', () => {
  it('язык из <html lang>, запасной — ru', () => {
    expect(getLocale()).toBe('ru')
    document.documentElement.lang = 'en-US'
    expect(getLocale()).toBe('en')
    document.documentElement.lang = 'zz'
    expect(getLocale()).toBe('ru')
  })

  it('t: параметры, склонения ru/en, запасной язык, нет ключа — сам ключ', () => {
    expect(t('kit.schema.minChars', { count: 2 })).toBe('Минимум 2 символа')
    expect(t('kit.schema.minChars', { count: 5 })).toBe('Минимум 5 символов')
    expect(t('kit.schema.minChars', { count: 21 })).toBe('Минимум 21 символ')
    setLocale('en')
    expect(t('kit.schema.minChars', { count: 1 })).toBe('At least 1 character')
    expect(t('kit.schema.minChars', { count: 3 })).toBe('At least 3 characters')
    addMessages('ru', { only: { ru: 'Только по-русски' } })
    expect(t('only.ru')).toBe('Только по-русски')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(t('nope.key')).toBe('nope.key')
    expect(hasMessage('nope.key')).toBe(false)
  })

  it('addMessages сливает словари и позволяет поправить тексты кита', () => {
    addMessages('ru', { kit: { form: { invalid: 'Ой, проверьте поля' } } })
    expect(t('kit.form.invalid')).toBe('Ой, проверьте поля')
    expect(t('kit.form.success')).toContain('Спасибо')
    addMessages('ru', { kit: { form: { invalid: 'Проверьте выделенные поля' } } })
  })

  it('setLocale: lang, перевод страницы, событие, запоминание; неизвестный язык — ошибка', () => {
    addMessages('ru', { hero: { title: 'Привет' }, search: { ph: 'Поиск' } })
    addMessages('en', { hero: { title: 'Hello' }, search: { ph: 'Search' } })
    const h1 = html('<h1 data-i18n="hero.title">Привет</h1>')
    const input = html('<input data-i18n-attr="placeholder:search.ph">')
    const fn = vi.fn()
    const off = onLocaleChange(fn)
    setLocale('en', { remember: true })
    expect(document.documentElement.lang).toBe('en')
    expect(h1.textContent).toBe('Hello')
    expect(input.placeholder).toBe('Search')
    expect(fn).toHaveBeenCalledWith('en')
    expect(JSON.parse(localStorage.getItem('locale'))).toBe('en')
    off()
    expect(() => setLocale('xx')).toThrow(/нет словаря/)
    localStorage.clear()
  })

  it('схема говорит на языке, выбранном ПОСЛЕ её создания', () => {
    const schema = s.string().email()
    expect(schema.safeParse('x').error).toContain('Введите e-mail')
    setLocale('en')
    expect(schema.safeParse('x').error).toContain('Enter an e-mail')
    expect(lazyT('kit.schema.required')()).toBe('This field is required')
  })

  it('translatePage: data-i18n-count и data-i18n-html', () => {
    addMessages('ru', {
      cart: { items: { one: '{count} товар', few: '{count} товара', many: '{count} товаров' }, b: '<b>жирно</b>' },
    })
    const p = html('<p data-i18n="cart.items" data-i18n-count="3"></p>')
    const b = html('<p data-i18n-html="cart.b"></p>')
    translatePage()
    expect(p.textContent).toBe('3 товара')
    expect(b.querySelector('b')).toBeTruthy()
  })

  it('lang-switch: кнопки меняют язык и помечают текущий; ссылки — только помечаются', () => {
    const root = html('<div><button data-lang="ru">RU</button><button data-lang="en">EN</button></div>')
    const api = langSwitch(root)
    expect(root.querySelector('[data-lang=ru]').getAttribute('aria-pressed')).toBe('true')
    root.querySelector('[data-lang=en]').click()
    expect(getLocale()).toBe('en')
    expect(root.querySelector('[data-lang=en]').getAttribute('aria-pressed')).toBe('true')
    api.destroy()
    resetLocale()
    document.documentElement.lang = 'en'
    const nav = html('<nav><a href="/" hreflang="ru">RU</a><a href="/en/" hreflang="en">EN</a></nav>')
    langSwitch(nav)
    expect(nav.querySelector('[hreflang=en]').getAttribute('aria-current')).toBe('true')
    localStorage.clear()
  })
})
