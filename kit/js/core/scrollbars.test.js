import { afterEach, describe, expect, it } from 'vitest'
import { attachScrollbar, scrollbarOptions, setKitScrollbars } from './scrollbars.js'
import { html } from '@test/helpers.js'

afterEach(() => {
  setKitScrollbars(true)
  document.body.innerHTML = ''
})

describe('scrollbars (для блоков внутри модулей кита)', () => {
  it('настройки: ось и тема кита', () => {
    expect(scrollbarOptions({ axis: 'x' }).overflow).toEqual({ x: 'scroll', y: 'hidden' })
    expect(scrollbarOptions().scrollbars.theme).toBe('os-theme-kit')
  })

  it('подключает OverlayScrollbars и убирает его', async () => {
    const el = html('<div><p>a</p></div>')
    const detach = attachScrollbar(el, { force: true })
    await detach.ready
    expect(el.hasAttribute('data-overlayscrollbars')).toBe(true)
    detach()
    expect(el.hasAttribute('data-overlayscrollbars')).toBe(false)
  })

  it('без мыши (тач), выключено в проекте или data-scrollbar="native" — не подключается', async () => {
    const touch = attachScrollbar(html('<div></div>')) // в jsdom нет (pointer: fine)
    expect(await touch.ready).toBeNull()
    setKitScrollbars(false)
    const off = html('<div></div>')
    window.matchMedia = /** @type {any} */ (
      (q) => ({ matches: q === '(pointer: fine)', addEventListener() {}, removeEventListener() {} })
    )
    expect(await attachScrollbar(off).ready).toBeNull()
    setKitScrollbars(true)
    const native = html('<div data-scrollbar="native"><div class="inner"></div></div>')
    expect(await attachScrollbar(native.querySelector('.inner')).ready).toBeNull()
  })

  it('уборка до загрузки библиотеки — ничего не подключится', async () => {
    const el = html('<div></div>')
    const detach = attachScrollbar(el, { force: true })
    detach()
    await detach.ready
    expect(el.hasAttribute('data-overlayscrollbars')).toBe(false)
  })
})
