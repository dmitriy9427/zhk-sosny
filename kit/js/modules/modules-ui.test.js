/**
 * Тесты интерфейсных модулей: аккордеон, табы, модалка, меню, форма, тосты, тема.
 */
import { describe, expect, it, vi } from 'vitest'
import accordion from './accordion/index.js'
import tabs from './tabs/index.js'
import dialog from './dialog/index.js'
import menu from './menu/index.js'
import toastTriggers, { toast } from './toast/index.js'
import themeSwitch, { THEME_SCRIPT, currentTheme } from './theme-switch/index.js'
import { isScrollLocked, resetScrollLock } from '../core/scroll-lock.js'
import { createCtx, html, key, tick } from '../../../test/helpers.js'

const ACCORDION = `
  <div data-module="accordion">
    ${[0, 1, 2]
      .map(
        (i) => `<div data-accordion-item ${i === 0 ? 'data-open' : ''} id="q${i}">
          <button data-accordion-trigger>Вопрос ${i}</button>
          <div data-accordion-panel><a href="#">ссылка</a></div>
        </div>`,
      )
      .join('')}
  </div>`

describe('accordion', () => {
  it('начальное состояние из data-open, aria и inert', () => {
    const root = html(ACCORDION)
    accordion(root)
    const [first, second] = root.querySelectorAll('[data-accordion-trigger]')
    expect(first.getAttribute('aria-expanded')).toBe('true')
    expect(second.getAttribute('aria-expanded')).toBe('false')
    expect(root.querySelectorAll('[data-accordion-panel]')[1].inert).toBe(true)
    expect(first.getAttribute('aria-controls')).toBe(root.querySelector('[data-accordion-panel]').id)
  })

  it('в одиночном режиме открытие закрывает остальные; событие toggle', () => {
    const root = html(ACCORDION)
    const api = accordion(root)
    const events = []
    root.addEventListener('accordion:toggle', (e) => events.push(e.detail))
    root.querySelectorAll('[data-accordion-trigger]')[1].click()
    expect(api.isOpen(0)).toBe(false)
    expect(api.isOpen(1)).toBe(true)
    expect(events.map((e) => [e.index, e.open])).toEqual([
      [0, false],
      [1, true],
    ])
  })

  it('multiple: открыто несколько; клавиши переводят фокус', () => {
    const root = html(ACCORDION)
    const api = accordion(root, { options: { multiple: true } })
    api.open(2)
    expect(api.isOpen(0) && api.isOpen(2)).toBe(true)
    const triggers = root.querySelectorAll('[data-accordion-trigger]')
    triggers[0].focus()
    key(triggers[0], 'ArrowUp')
    expect(document.activeElement).toBe(triggers[2])
    key(triggers[2], 'Home')
    expect(document.activeElement).toBe(triggers[0])
  })

  it('открывает пункт по #хешу и падает с понятной ошибкой при неполной разметке', () => {
    location.hash = '#q2'
    const root = html(ACCORDION)
    expect(accordion(root).isOpen(2)).toBe(true)
    location.hash = ''
    const bad = html('<div data-module="accordion"><div data-accordion-item></div></div>')
    expect(() => accordion(bad)).toThrow(/data-accordion-trigger/)
  })

  it('вложенный аккордеон обслуживает сам себя (и без data-module, как в React)', () => {
    const root = html(`<div>
      <div data-accordion-item><button data-accordion-trigger>A</button>
        <div data-accordion-panel>
          <div class="inner"><div data-accordion-item><button data-accordion-trigger>B</button><div data-accordion-panel>b</div></div></div>
        </div>
      </div></div>`)
    const outer = accordion(root)
    const inner = accordion(root.querySelector('.inner'))
    outer.open(0)
    expect(outer.isOpen(1)).toBe(false) // у внешнего ровно один пункт
    inner.open(0)
    expect(outer.isOpen(0)).toBe(true) // открытие внутреннего не закрыло внешний
  })

  it('destroy снимает обработчики', () => {
    const root = html(ACCORDION)
    const api = accordion(root)
    api.destroy()
    root.querySelectorAll('[data-accordion-trigger]')[1].click()
    expect(api.isOpen(1)).toBe(false)
  })
})

describe('tabs', () => {
  const TABS = `
    <div data-module="tabs">
      <div data-tabs-list><button data-tabs-tab>A</button><button data-tabs-tab>B</button><button data-tabs-tab>C</button></div>
      <div data-tabs-panel id="pa">a</div><div data-tabs-panel id="pb">b</div><div data-tabs-panel id="pc">c</div>
    </div>`

  it('роли, aria, скрытые панели, бегущий tabindex', () => {
    const root = html(TABS)
    tabs(root)
    const tabEls = root.querySelectorAll('[data-tabs-tab]')
    const panels = root.querySelectorAll('[data-tabs-panel]')
    expect(root.querySelector('[data-tabs-list]').getAttribute('role')).toBe('tablist')
    expect(tabEls[0].getAttribute('aria-selected')).toBe('true')
    expect([...tabEls].map((t) => t.tabIndex)).toEqual([0, -1, -1])
    expect([...panels].map((p) => p.hidden)).toEqual([false, true, true])
    expect(tabEls[1].type).toBe('button')
  })

  it('клик, стрелки по кругу, событие change', () => {
    const root = html(TABS)
    const api = tabs(root)
    const changes = []
    root.addEventListener('tabs:change', (e) => changes.push(e.detail.index))
    const tabEls = root.querySelectorAll('[data-tabs-tab]')
    tabEls[1].click()
    key(tabEls[1], 'ArrowRight')
    key(tabEls[2], 'ArrowRight')
    expect(api.index).toBe(0)
    expect(document.activeElement).toBe(tabEls[0])
    expect(changes).toEqual([1, 2, 0])
    api.destroy()
  })

  it('вкладка хранится в ?параметре адреса: запись, чтение после «перезагрузки», вкладка по умолчанию не пишется', () => {
    const root = html(TABS.replace('data-module="tabs"', 'data-module="tabs" id="product"'))
    const api = tabs(root)
    root.querySelectorAll('[data-tabs-tab]')[2].click()
    expect(new URL(location.href).searchParams.get('product')).toBe('pc') // значение = id панели
    api.destroy()
    // «Перезагрузка»: новый экземпляр читает адрес.
    const again = tabs(html(TABS.replace('data-module="tabs"', 'data-module="tabs" id="product"')))
    expect(again.index).toBe(2)
    again.select(0)
    expect(location.search).toBe('') // вкладка по умолчанию — адрес чистый
    again.destroy()
  })

  it('data-tabs-value и data-tabs-param; popstate возвращает вкладку из адреса', () => {
    const markup = `<div data-tabs-param="faq"><div data-tabs-list>
      <button data-tabs-tab data-tabs-value="pay">A</button><button data-tabs-tab data-tabs-value="ship">B</button></div>
      <div data-tabs-panel></div><div data-tabs-panel></div></div>`
    history.replaceState(null, '', '?faq=ship')
    const api = tabs(html(markup))
    expect(api.index).toBe(1)
    history.replaceState(null, '', '?faq=pay')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(api.index).toBe(0)
    api.destroy()
  })

  it('url=false не трогает адрес; одинаковые параметры — предупреждение; неверный адрес — вкладка по умолчанию', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const off = tabs(html(TABS.replace('data-module="tabs"', 'data-module="tabs" data-tabs-url="false"')))
    off.select(1)
    expect(location.search).toBe('')
    history.replaceState(null, '', '?tab=nope')
    const a = tabs(html(TABS.replace('data-module="tabs"', 'data-module="tabs" data-tabs-active="2"')))
    expect(a.index).toBe(2)
    const b = tabs(html(TABS))
    expect(warn.mock.calls.some(([m]) => m.includes('уже занят'))).toBe(true)
    ;[off, a, b].forEach((t) => t.destroy())
  })

  it('старые ссылки #id-панели и несовпадение числа вкладок/панелей', () => {
    location.hash = '#pb'
    const api = tabs(html(TABS))
    expect(api.index).toBe(1)
    api.destroy()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tabs(html('<div data-module="tabs"><button data-tabs-tab>A</button></div>')).destroy()
    expect(warn).toHaveBeenCalled()
  })
})

describe('dialog', () => {
  const DIALOG = `<dialog id="d1" data-module="dialog"><div class="dialog__box"><button data-dialog-close>x</button></div></dialog>`

  it('открывается кнопкой с data-dialog-open, блокирует прокрутку, закрывается и возвращает фокус', async () => {
    resetScrollLock()
    const opener = html('<button data-dialog-open="d1">open</button>')
    const el = html(DIALOG)
    const api = dialog(el, createCtx())
    opener.focus()
    opener.click()
    expect(el.open).toBe(true)
    expect(isScrollLocked()).toBe(true)
    el.querySelector('[data-dialog-close]').click()
    await tick(5)
    expect(el.open).toBe(false)
    expect(isScrollLocked()).toBe(false)
    expect(document.activeElement).toBe(opener)
    api.destroy()
  })

  it('Esc (cancel) закрывает с анимацией, клик по фону — тоже', async () => {
    const el = html(DIALOG)
    const api = dialog(el, createCtx({ reduced: false }))
    api.open()
    const cancel = new Event('cancel', { cancelable: true })
    el.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(el.classList.contains('is-closing')).toBe(true)
    el.dispatchEvent(new Event('animationend'))
    expect(el.open).toBe(false)
    api.open()
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    el.dispatchEvent(new Event('animationend'))
    expect(el.open).toBe(false)
    api.destroy()
  })

  it('адрес: открытие пишет #id (новая запись истории), закрытие её снимает', async () => {
    const el = html(DIALOG)
    const api = dialog(el, createCtx())
    const before = history.length
    api.open()
    expect(location.hash).toBe('#d1')
    expect(history.length).toBe(before + 1)
    api.close()
    await tick(20) // history.back() асинхронный
    expect(location.hash).toBe('')
    api.destroy()
  })

  it('адрес с #id открывает окно сразу; «Назад» (popstate) закрывает; ссылка href="#id" открывает', async () => {
    history.replaceState(null, '', '#d1')
    const el = html(DIALOG)
    const api = dialog(el, createCtx())
    expect(el.open).toBe(true)
    history.replaceState(null, '', location.pathname)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await tick(5)
    expect(el.open).toBe(false)
    const link = html('<a href="#d1">open</a>')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(el.open).toBe(true)
    api.destroy()
  })

  it('открытое по внешней ссылке окно при закрытии просто стирает хеш (без ухода со страницы)', async () => {
    history.replaceState(null, '', '#d1')
    const el = html(DIALOG)
    const api = dialog(el, createCtx())
    const back = vi.spyOn(history, 'back')
    api.close()
    await tick(5)
    expect(back).not.toHaveBeenCalled()
    expect(location.hash).toBe('')
    api.destroy()
  })

  it('повторное открытие во время закрытия; destroy снимает блокировку', () => {
    const el = html(DIALOG)
    const api = dialog(el, createCtx({ reduced: false }))
    api.open()
    api.close()
    api.open()
    expect(api.isOpen).toBe(true)
    api.destroy()
    expect(isScrollLocked()).toBe(false)
    expect(() => dialog(html('<div></div>'))).toThrow(/<dialog>/)
  })
})

describe('menu', () => {
  const MENU = `<header><button data-module="menu" data-menu-target="m">≡</button><nav id="m"><a href="#a">a</a></nav></header>`

  it('открывает/закрывает, aria, блокировка, Esc, клик по ссылке', () => {
    resetScrollLock()
    const header = html(MENU)
    const button = header.querySelector('button')
    const panel = header.querySelector('nav')
    const bus = createCtx().bus
    const toggles = []
    bus.on('menu:toggle', (v) => toggles.push(v))
    const api = menu(button, { bus })
    expect(panel.inert).toBe(true)
    button.click()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(panel.classList.contains('is-open')).toBe(true)
    expect(isScrollLocked()).toBe(true)
    key(document, 'Escape')
    expect(api.isOpen).toBe(false)
    api.open()
    panel.querySelector('a').click()
    expect(api.isOpen).toBe(false)
    expect(isScrollLocked()).toBe(false)
    expect(toggles).toEqual([true, false, true, false])
    api.destroy()
  })

  it('без панели — понятная ошибка', () => {
    expect(() => menu(html('<button data-menu-target="nope"></button>'))).toThrow(/nope/)
  })
})

describe('toast', () => {
  it('создаёт aria-live регион, закрывается по таймеру и кнопке', () => {
    vi.useFakeTimers()
    const t = toast('Привет <b>', { type: 'success', duration: 1000 })
    expect(document.querySelector('.toasts').getAttribute('aria-live')).toBe('polite')
    expect(t.el.querySelector('.toast__text').textContent).toBe('Привет <b>')
    vi.advanceTimersByTime(1500)
    expect(t.el.isConnected).toBe(false)
    const err = toast('Ошибка', { type: 'error', duration: 0 })
    expect(err.el.getAttribute('role')).toBe('alert')
    err.el.querySelector('button').click()
    vi.advanceTimersByTime(500)
    expect(err.el.isConnected).toBe(false)
    vi.useRealTimers()
  })

  it('модуль: кнопки с data-toast', () => {
    const root = html('<div><button data-toast="Скопировано" data-toast-type="success">c</button></div>')
    const api = toastTriggers(root)
    root.querySelector('button').click()
    expect(document.querySelector('.toast--success').textContent).toContain('Скопировано')
    api.destroy()
  })
})

describe('theme-switch', () => {
  it('переключает тему, запоминает и выставляет aria-pressed', () => {
    const button = html('<button></button>')
    const api = themeSwitch(button)
    expect(currentTheme()).toBe('light')
    button.click()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem('theme'))).toBe('dark')
    api.destroy()
    localStorage.clear()
  })

  it('скрипт для <head> применяет сохранённую тему', () => {
    localStorage.setItem('theme', '"dark"')
    new Function(THEME_SCRIPT)()
    expect(document.documentElement.dataset.theme).toBe('dark')
    localStorage.clear()
  })
})
