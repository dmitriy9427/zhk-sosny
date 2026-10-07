import { describe, expect, it, vi } from 'vitest'
import { html } from '@test/helpers.js'

// Настоящий Lenis в jsdom не нужен — проверяем, с какими настройками его создают.
const created = []
vi.mock('lenis', () => ({
  default: class {
    constructor(options) {
      this.options = options
      created.push(this)
    }
    on() {}
    raf() {}
    destroy() {}
  },
}))

const { createSmoothScroll, NESTED_SCROLL } = await import('./smooth-scroll.js')

describe('smooth-scroll: вложенная прокрутка', () => {
  it('Lenis создаётся с allowNestedScroll и пропускает блоки кита', () => {
    const scroll = createSmoothScroll({ anchors: false })
    const { options } = created.at(-1)
    expect(options.allowNestedScroll).toBe(true)
    const match = (markup) => options.prevent(html(markup))
    expect(match('<dialog></dialog>')).toBe(true)
    expect(match('<div class="select__dropdown"></div>')).toBe(true)
    expect(match('<nav class="nav mobile-menu"></nav>')).toBe(true)
    expect(match('<div class="scroll-area"></div>')).toBe(true)
    expect(match('<textarea></textarea>')).toBe(true)
    expect(match('<div data-lenis-prevent></div>')).toBe(true)
    expect(match('<section class="hero"></section>')).toBe(false)
    expect(NESTED_SCROLL).toContain('[popover]')
    scroll.destroy()
  })

  it('свои блоки — опцией prevent', () => {
    const scroll = createSmoothScroll({ anchors: false, prevent: (node) => node.classList.contains('chat') })
    const { options } = created.at(-1)
    expect(options.prevent(html('<div class="chat"></div>'))).toBe(true)
    expect(options.prevent(html('<div class="other"></div>'))).toBe(false)
    scroll.destroy()
  })
})
