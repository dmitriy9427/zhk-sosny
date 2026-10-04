import { describe, expect, it, vi } from 'vitest'
import { createBus } from './bus.js'
import { createDisposer, onViewport } from './lifecycle.js'
import { coerce, readOptions } from './options.js'
import { clamp, damp, lerp, mapRange, round, wrap } from './math.js'
import { debounce, throttle } from './timing.js'
import { readStorage, removeStorage, writeStorage } from './storage.js'
import { DEFAULT_BREAKPOINTS, getBreakpoints, prefersReducedMotion, upQuery, watchMedia } from './env.js'
import { delegate, ensureId, focusable, trapFocus } from './dom.js'
import { isScrollLocked, lockScroll, resetScrollLock, setScrollEngine, unlockScroll } from './scroll-lock.js'
import { html, key } from '../../../test/helpers.js'

describe('bus', () => {
  it('on/emit/off, replay и once', () => {
    const bus = createBus()
    const fn = vi.fn()
    const off = bus.on('a', fn)
    bus.emit('a', 1)
    off()
    bus.emit('a', 2)
    expect(fn.mock.calls).toEqual([[1]])
    const late = vi.fn()
    bus.on('a', late, { replay: true })
    expect(late).toHaveBeenCalledWith(2)
    const once = vi.fn()
    bus.once('b', once)
    bus.emit('b', 1)
    bus.emit('b', 2)
    expect(once).toHaveBeenCalledTimes(1)
  })

  it('ошибка подписчика не мешает остальным', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bus = createBus()
    const ok = vi.fn()
    bus.on('x', () => {
      throw new Error()
    })
    bus.on('x', ok)
    bus.emit('x')
    expect(ok).toHaveBeenCalled()
  })
})

describe('lifecycle', () => {
  it('dispose в обратном порядке, один раз; поздний add выполняется сразу', () => {
    const d = createDisposer()
    const order = []
    d.add(() => order.push(1))
    d.add(() => order.push(2))
    d.dispose()
    d.dispose()
    expect(order).toEqual([2, 1])
    const late = vi.fn()
    d.add(late)
    expect(late).toHaveBeenCalled()
  })

  it('listen снимает обработчик', () => {
    const d = createDisposer()
    const fn = vi.fn()
    d.listen(window, 'resize', fn)
    d.dispose()
    window.dispatchEvent(new Event('resize'))
    expect(fn).not.toHaveBeenCalled()
  })

  it('onViewport зовёт enter/leave при смене состояния, once отключается', () => {
    const el = html('<div></div>')
    const enter = vi.fn()
    const leave = vi.fn()
    onViewport(el, { enter, leave })
    triggerIntersect(el, true)
    triggerIntersect(el, true)
    triggerIntersect(el, false)
    expect(enter).toHaveBeenCalledTimes(1)
    expect(leave).toHaveBeenCalledTimes(1)
    const once = vi.fn()
    onViewport(el, { enter: once, once: true })
    triggerIntersect(el, true)
    triggerIntersect(el, false)
    triggerIntersect(el, true)
    expect(once).toHaveBeenCalledTimes(1)
  })
})

describe('options', () => {
  it('приводит типы по значению по умолчанию', () => {
    expect(coerce('false', true)).toBe(false)
    expect(coerce('', false)).toBe(true)
    expect(coerce('12', 0)).toBe(12)
    expect(coerce('abc', 5)).toBe(5)
    expect(coerce('[1,2]', [])).toEqual([1, 2])
    expect(coerce('x', 'y')).toBe('x')
  })

  it('читает data-атрибуты в camelCase, overrides важнее, предупреждает об опечатках', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = html('<div data-m-speed="80" data-m-pause-on-hover="false" data-m-typo="1"></div>')
    const o = readOptions(el, 'm', { speed: 10, pauseOnHover: true, label: 'a' }, { label: 'b' })
    expect(o).toEqual({ speed: 80, pauseOnHover: false, label: 'b' })
    expect(warn.mock.calls[0][0]).toContain('data-m-typo')
  })

  it('битый JSON — значение по умолчанию', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(coerce('{oops', { a: 1 })).toEqual({ a: 1 })
  })
})

describe('math', () => {
  it('базовые функции', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(lerp(0, 10, 0.5)).toBe(5)
    expect(mapRange(5, 0, 10, 100, 200)).toBe(150)
    expect(mapRange(50, 0, 10, 0, 1)).toBe(1)
    expect(mapRange(1, 1, 1, 7, 9)).toBe(7)
    expect(wrap(5, 0, 4)).toBe(1)
    expect(wrap(-1, 0, 4)).toBe(3)
    expect(wrap(3, 2, 2)).toBe(2)
    expect(round(1.2345, 2)).toBe(1.23)
  })

  it('damp не зависит от частоты кадров', () => {
    let a = 0
    for (let i = 0; i < 60; i++) a = damp(a, 1, 5, 1 / 60)
    let b = 0
    for (let i = 0; i < 120; i++) b = damp(b, 1, 5, 1 / 120)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('timing', () => {
  it('debounce зовёт один раз после паузы', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d(1)
    d(2)
    vi.advanceTimersByTime(100)
    expect(fn.mock.calls).toEqual([[2]])
    vi.useRealTimers()
  })

  it('throttle не теряет последний вызов', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const t = throttle(fn, 100)
    t(1)
    t(2)
    t(3)
    expect(fn.mock.calls).toEqual([[1]])
    vi.advanceTimersByTime(100)
    expect(fn.mock.calls).toEqual([[1], [3]])
    vi.useRealTimers()
  })
})

describe('storage', () => {
  it('пишет и читает JSON, переживает исключения', () => {
    writeStorage('k', { a: 1 })
    expect(readStorage('k')).toEqual({ a: 1 })
    removeStorage('k')
    expect(readStorage('k', 'def')).toBe('def')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(readStorage('k', 'def')).toBe('def')
    expect(writeStorage('k', 1)).toBe(false)
  })
})

describe('env', () => {
  it('брейкпоинты из CSS-переменных с запасными значениями', () => {
    expect(getBreakpoints()).toEqual(DEFAULT_BREAKPOINTS)
    document.documentElement.style.setProperty('--bp-md', '800px')
    expect(getBreakpoints().md).toBe(800)
    expect(upQuery('md')).toBe('(min-width: 800px)')
    expect(() => upQuery('huge')).toThrow()
  })

  it('reduced motion и watchMedia', () => {
    expect(prefersReducedMotion()).toBe(false)
    setMedia({ '(prefers-reduced-motion: reduce)': true })
    expect(prefersReducedMotion()).toBe(true)
    const fn = vi.fn()
    watchMedia('(min-width: 1px)', fn)()
    expect(fn).toHaveBeenCalledWith(false)
  })
})

describe('dom', () => {
  it('ensureId, delegate', () => {
    const el = html('<ul><li><button class="b">x</button></li></ul>')
    expect(ensureId(el, 'list')).toMatch(/^list-\d+/)
    const fn = vi.fn()
    const off = delegate(el, 'click', '.b', fn)
    el.querySelector('.b').click()
    off()
    el.querySelector('.b').click()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('trapFocus перекидывает фокус с последнего на первый', () => {
    const box = html('<div><button id="a">a</button><button id="b">b</button></div>')
    box.querySelectorAll('button').forEach((b) => (b.getClientRects = () => [1]))
    expect(focusable(box)).toHaveLength(2)
    const release = trapFocus(box)
    box.querySelector('#b').focus()
    key(document, 'Tab')
    expect(document.activeElement.id).toBe('a')
    key(document, 'Tab', { shiftKey: true })
    expect(document.activeElement.id).toBe('b')
    release()
  })
})

describe('scroll-lock', () => {
  it('счётчик вложенных блокировок и остановка плавного скролла', () => {
    const engine = { stop: vi.fn(), start: vi.fn() }
    setScrollEngine(engine)
    lockScroll()
    lockScroll()
    unlockScroll()
    expect(isScrollLocked()).toBe(true)
    expect(document.documentElement.classList.contains('is-scroll-locked')).toBe(true)
    unlockScroll()
    unlockScroll() // лишний — без последствий
    expect(isScrollLocked()).toBe(false)
    expect(engine.stop).toHaveBeenCalledTimes(1)
    expect(engine.start).toHaveBeenCalledTimes(1)
    lockScroll()
    resetScrollLock()
    expect(isScrollLocked()).toBe(false)
    setScrollEngine(null)
  })
})
