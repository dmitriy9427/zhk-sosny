import { describe, expect, it, vi } from 'vitest'
import { getInstance, isLazy, lazy, mount, moduleNames, observe, unmount } from './registry.js'
import { html, tick } from '../../../test/helpers.js'

describe('registry', () => {
  it('запускает модуль по data-module и передаёт ctx', async () => {
    const el = html('<div data-module="a"></div>')
    const init = vi.fn(() => ({ destroy() {} }))
    const ctx = { x: 1 }
    const result = await mount({ a: init }, ctx)
    expect(init).toHaveBeenCalledWith(el, ctx)
    expect(result.mounted).toEqual(['a'])
  })

  it('не запускает модуль дважды на одном элементе', async () => {
    html('<div data-module="a"></div>')
    const init = vi.fn()
    await mount({ a: init })
    await mount({ a: init })
    expect(init).toHaveBeenCalledTimes(1)
  })

  it('несколько модулей через пробел', async () => {
    html('<div data-module="a  b"></div>')
    const a = vi.fn()
    const b = vi.fn()
    await mount({ a, b })
    expect(a).toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
    expect(moduleNames(html('<i data-module=" x y "></i>'))).toEqual(['x', 'y'])
  })

  it('ошибка одного модуля не мешает остальным', async () => {
    html('<div data-module="bad"></div><div data-module="good"></div>')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const good = vi.fn()
    const result = await mount({
      bad: () => {
        throw new Error('x')
      },
      good,
    })
    expect(good).toHaveBeenCalled()
    expect(result.failed).toEqual(['bad'])
    expect(error).toHaveBeenCalled()
  })

  it('неизвестное имя: предупреждение в strict, тишина без него', async () => {
    html('<div data-module="nope"></div>')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mount({}, {}, document, { strict: false })
    expect(warn).not.toHaveBeenCalled()
    await mount({ other: vi.fn() })
    expect(warn.mock.calls[0][0]).toContain('nope')
    expect(warn.mock.calls[0][0]).toContain('other')
  })

  it('unmount зовёт destroy, после чего можно запустить снова', async () => {
    const el = html('<div data-module="a"></div>')
    const destroy = vi.fn()
    const init = vi.fn(() => ({ destroy, api: 1 }))
    await mount({ a: init })
    expect(getInstance(el, 'a').api).toBe(1)
    unmount()
    expect(destroy).toHaveBeenCalledTimes(1)
    await mount({ a: init })
    expect(init).toHaveBeenCalledTimes(2)
  })

  it('lazy грузит код один раз и только при наличии блока', async () => {
    html('<div data-module="l"></div><div data-module="l"></div>')
    const init = vi.fn()
    const loader = vi.fn(async () => ({ default: init }))
    const registry = { l: lazy(loader), unused: lazy(vi.fn()) }
    expect(isLazy(registry.l)).toBe(true)
    await mount(registry)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(init).toHaveBeenCalledTimes(2)
  })

  it('элемент размонтировали, пока модуль грузился — destroy вызывается сразу', async () => {
    const el = html('<div data-module="slow"></div>')
    const destroy = vi.fn()
    const pending = mount({
      slow: async () => {
        await tick(5)
        return { destroy }
      },
    })
    unmount(el.parentNode)
    await pending
    expect(destroy).toHaveBeenCalled()
  })

  it('observe запускает модули в добавленном контенте и останавливает в удалённом', async () => {
    const destroy = vi.fn()
    const init = vi.fn(() => ({ destroy }))
    const stop = observe({ a: init }, {}, document.body)
    const box = html('<section><div data-module="a"></div></section>')
    await tick()
    expect(init).toHaveBeenCalledTimes(1)
    box.remove()
    await tick()
    expect(destroy).toHaveBeenCalledTimes(1)
    stop()
  })
})
