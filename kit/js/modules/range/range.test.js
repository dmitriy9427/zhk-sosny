import { describe, expect, it, vi } from 'vitest'
import range, { formatRangeValue, percentOf } from './index.js'
import { html } from '@test/helpers.js'

const MARKUP = `<div><input type="range" min="0" max="100" value="10"><input type="range" min="0" max="100" value="90">
  <output data-range-min></output><output data-range-max></output>
  <input type="number" data-range-input="min"><input type="number" data-range-input="max"></div>`

describe('range', () => {
  it('formatRangeValue и percentOf', () => {
    expect(formatRangeValue(12500000, 'price')).toBe('12,5 млн ₽')
    expect(formatRangeValue(950000, 'price')).toBe('950 000 ₽')
    expect(formatRangeValue(42.5, 'area')).toBe('42,5 м²')
    expect(formatRangeValue(5, 'number', ' эт.')).toBe('5 эт.')
    expect(percentOf(25, 0, 100)).toBe(25)
    expect(percentOf(5, 5, 5)).toBe(0)
  })

  it('заливка, подписи, ручки не проходят друг через друга', () => {
    const root = html(MARKUP)
    const api = range(root)
    const [low, high] = root.querySelectorAll('input[type=range]')
    expect(root.style.getPropertyValue('--from')).toBe('10%')
    expect(root.querySelector('[data-range-max]').textContent).toBe('90')
    low.value = '95'
    low.dispatchEvent(new Event('input'))
    expect(low.value).toBe('90')
    high.value = '5'
    high.dispatchEvent(new Event('input'))
    expect(high.value).toBe('90')
    expect(api.value).toEqual({ min: 90, max: 90 })
    expect(low.style.zIndex).toBe('3') // у правого края левая ручка сверху
  })

  it('точный ввод числом, событие range:change, set из кода, ошибка без ползунков', () => {
    const root = html(MARKUP)
    const api = range(root)
    const change = vi.fn()
    root.addEventListener('range:change', change)
    const num = root.querySelector('[data-range-input="max"]')
    num.value = '500'
    num.dispatchEvent(new Event('change'))
    expect(api.value.max).toBe(100)
    expect(change.mock.calls.at(-1)[0].detail).toEqual({ min: 10, max: 100 })
    api.set(20, 30)
    expect(root.querySelector('[data-range-min]').textContent).toBe('20')
    api.destroy()
    expect(() => range(html('<div></div>'))).toThrow(/range/)
  })
})
