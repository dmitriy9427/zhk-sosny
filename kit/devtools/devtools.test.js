import { describe, expect, it, vi } from 'vitest'
import { accessibleName, checkA11y, findOverflow, listModules } from './checks.js'
import { installDevtools } from './index.js'
import { DEVTOOLS_MARKER } from '../vite/devtools-guard.js'
import { html, setSize } from '../../test/helpers.js'

describe('проверки', () => {
  it('findOverflow находит самый глубокий вылезающий элемент', () => {
    const box = setSize(html('<div><p></p></div>'), { width: 300 })
    const p = box.querySelector('p')
    p.getBoundingClientRect = () => ({ left: 0, right: 500, width: 500 })
    box.getBoundingClientRect = () => ({ left: 0, right: 500, width: 500 })
    const found = findOverflow(document.body, 375)
    expect(found.map((f) => f.el)).toEqual([p])
    expect(found[0].message).toBe('вылезает на 125px')
  })

  it('accessibleName учитывает aria-label, aria-labelledby, alt картинки', () => {
    expect(accessibleName(html('<button aria-label="Меню"></button>'))).toBe('Меню')
    html('<span id="lbl">Корзина</span>')
    expect(accessibleName(html('<button aria-labelledby="lbl"></button>'))).toBe('Корзина')
    expect(accessibleName(html('<a href="/"><img alt="Логотип"></a>'))).toBe('Логотип')
    expect(accessibleName(html('<button></button>'))).toBe('')
  })

  it('checkA11y ловит типовые ошибки', () => {
    html(`<main>
      <img src="a.jpg">
      <button></button>
      <input name="q" placeholder="Поиск">
      <label>Имя <input name="n"></label>
      <div id="dup"></div><div id="dup"></div>
      <h1>Заголовок</h1><h3>Пропуск</h3>
      <a href="#" tabindex="3">x</a>
    </main>`)
    const messages = checkA11y().map((i) => i.message)
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('без alt'),
        expect.stringContaining('button без текста'),
        expect.stringContaining('поле без <label>'),
        expect.stringContaining('повторяющийся id="dup"'),
        expect.stringContaining('h1 → h3'),
        expect.stringContaining('tabindex > 0'),
        expect.stringContaining('нет lang'),
      ]),
    )
    expect(messages.filter((m) => m.includes('поле без'))).toHaveLength(1) // поле с label не ругаем
  })

  it('listModules показывает статус', () => {
    html('<div data-module="a b"></div>')
    const list = listModules((el, name) => (name === 'a' ? {} : undefined))
    expect(list.map((m) => `${m.name}:${m.status}`)).toEqual(['a:работает', 'b:не запущен'])
  })
})

describe('installDevtools', () => {
  it('ставит панель в Shadow DOM, включает инструменты, запоминает состояние и убирается', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const api = installDevtools()
    expect(installDevtools()).toBe(api) // повторный вызов не создаёт вторую панель
    expect(window[DEVTOOLS_MARKER]).toBe(api)
    const host = document.querySelector('[data-kit-devtools]:not(style)')
    expect(host.shadowRoot.querySelector('.panel')).toBeTruthy()

    api.set('outline', true)
    expect(document.documentElement.classList.contains('kit-dev-outline')).toBe(true)
    api.set('grid', true)
    expect(document.querySelector('.kit-dev-grid')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('kit-devtools')).grid).toBe(true)
    api.set('grid', false)
    expect(document.querySelector('.kit-dev-grid')).toBeNull()

    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    api.run('a11y')
    expect(host.shadowRoot.querySelector('.output h4').textContent).toContain('Проблемы доступности')

    api.destroy()
    expect(document.querySelector('[data-kit-devtools]')).toBeNull()
    expect(document.documentElement.classList.contains('kit-dev-outline')).toBe(false)
    expect(window[DEVTOOLS_MARKER]).toBeUndefined()
    localStorage.clear()
  })
})
