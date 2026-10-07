import { afterEach, describe, expect, it, vi } from 'vitest'
import { lazy, mount, unmount } from './registry.js'
import { createModulesApi, modulesFromGlob, pluginsFromGlob } from './modules.js'
import { html, tick } from '@test/helpers.js'

const modules = createModulesApi()
afterEach(() => {
  unmount(document)
  document.body.innerHTML = ''
})

const counter = (el) => {
  let n = 0
  return { inc: () => ++n, el, destroy() {} }
}
const plain = () => {} // модуль без API

describe('modules: доступ к модулям', () => {
  it('get по селектору/элементу, all, first', async () => {
    html('<div id="a" data-module="counter"></div>')
    html('<div id="b" data-module="counter plain"></div>')
    await mount({ counter, plain })
    expect(modules.get('#a').inc()).toBe(1)
    expect(modules.get(document.getElementById('b'), 'counter').inc()).toBe(1)
    expect(() => modules.get('#b')).toThrow(/несколько модулей \(counter, plain\)/)
    expect(modules.get('#b', 'plain')).toBeNull() // модуль без API — null, а не undefined
    expect(modules.get('#нет')).toBeUndefined()
    expect(modules.all('counter')).toHaveLength(2)
    expect(modules.first('counter').el.id).toBe('a')
  })

  it('when ждёт ленивый модуль, который ещё грузится', async () => {
    let release
    const slow = lazy(() => new Promise((resolve) => (release = () => resolve({ default: counter }))))
    html('<div id="cart" data-module="slow"></div>')
    const mounting = mount({ slow })
    expect(modules.get('#cart', 'slow')).toBeUndefined() // ещё не готов
    const waiting = modules.when('#cart', 'slow')
    release()
    await mounting
    expect((await waiting).inc()).toBe(1)
  })

  it('when по селектору элемента, которого ещё нет; whenAny; таймаут с понятной ошибкой', async () => {
    const later = modules.when('.later', 'counter')
    const any = modules.whenAny('counter')
    const el = html('<div class="later" data-module="counter"></div>')
    await mount({ counter }, {}, el)
    expect((await later).el).toBe(el)
    expect((await any).el).toBe(el)
    await expect(modules.when('#never', 'counter', { timeout: 20 })).rejects.toThrow(
      /не дождались запуска: counter на #never/,
    )
  })

  it('when отменяется через AbortSignal', async () => {
    const controller = new AbortController()
    const waiting = modules.when('#x', 'counter', { signal: controller.signal, timeout: 0 })
    controller.abort(new Error('ушли со страницы'))
    await expect(waiting).rejects.toThrow('ушли со страницы')
  })

  it('модули получают доступ друг к другу через ctx.modules', async () => {
    const opener = (el, ctx) => {
      el.addEventListener('click', async () => (await ctx.modules.when('#dlg', 'counter')).inc())
    }
    html('<button id="btn" data-module="opener"></button>')
    html('<div id="dlg" data-module="counter"></div>')
    await mount({ opener, counter }, { modules })
    document.getElementById('btn').click()
    await tick()
    expect(modules.get('#dlg').inc()).toBe(2)
  })
})

describe('modulesFromGlob', () => {
  it('имя из файла или папки index.js; тесты пропускаются; ленивые — через lazy', async () => {
    const loader = vi.fn(async () => ({ default: counter }))
    const registry = modulesFromGlob({
      './components/card/card.js': loader,
      './modules/price-calc/index.js': loader,
      './components/card/card.test.js': loader,
      './eager/x.js': { default: plain },
    })
    expect(Object.keys(registry).sort()).toEqual(['card', 'price-calc', 'x'])
    expect(loader).not.toHaveBeenCalled() // ленивый: не грузим, пока блока нет на странице
    html('<div data-module="card"></div>')
    await mount(registry)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('без export default — предупреждение и пропуск', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(modulesFromGlob({ './m/bad.js': { other: 1 } })).toEqual({})
    expect(warn.mock.calls[0][0]).toMatch(/нет export default/)
  })
})

describe('pluginsFromGlob', () => {
  it('порядок по имени файла, тесты и файлы без default пропускаются', () => {
    const a = () => {}
    const b = () => {}
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const list = pluginsFromGlob({
      './plugins/02-analytics.js': { default: b },
      './plugins/01-links.js': { default: a },
      './plugins/01-links.test.js': { default: () => {} },
      './plugins/03-bad.js': { setup: () => {} },
    })
    expect(list).toEqual([a, b])
    expect(warn.mock.calls[0][0]).toMatch(/03-bad\.js: плагин должен экспортировать default/)
  })
})
