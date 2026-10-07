import { describe, expect, it } from 'vitest'
import scrollbar from './index.js'
import { createCtx, html } from '@test/helpers.js'

describe('scrollbar', () => {
  it('оборачивает содержимое, ставит тему кита; destroy возвращает разметку', () => {
    const el = html('<div data-scrollbar-axis="x"><p>a</p><p>b</p></div>')
    const api = scrollbar(el, createCtx())
    expect(el.hasAttribute('data-overlayscrollbars')).toBe(true)
    expect(api.viewport.contains(el.querySelector('p'))).toBe(true)
    expect(api.instance.options().overflow).toEqual({ x: 'scroll', y: 'hidden' })
    expect(api.instance.options().scrollbars.theme).toBe('os-theme-kit')
    api.destroy()
    expect(el.hasAttribute('data-overlayscrollbars')).toBe(false)
    expect(el.children[0].tagName).toBe('P')
  })
})
