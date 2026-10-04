import { describe, expect, it } from 'vitest'
import { VELOCITY_FULL, centerOn, columnSpeed, squeezeScale, velocityUnit, wrapCell } from './grid.js'

describe('gallery/grid', () => {
  it('columnSpeed: дальние колонки медленнее', () => {
    expect(columnSpeed(0, 4, 0.1)).toBe(1)
    expect(columnSpeed(3, 4, 0.1)).toBeCloseTo(0.7)
    expect(columnSpeed(4, 4, 0.1)).toBe(1)
  })

  it('wrapCell заворачивает только целиком ушедшую ячейку', () => {
    expect(wrapCell(0, -50, 100, 1000)).toBe(-50)
    expect(wrapCell(0, -150, 100, 1000)).toBe(850)
    expect(wrapCell(900, 50, 100, 1000)).toBe(-50)
  })

  it('velocityUnit и squeezeScale ограничены', () => {
    expect(velocityUnit(VELOCITY_FULL / 2)).toBe(0.5)
    expect(velocityUnit(-1e6)).toBe(-1)
    expect(squeezeScale(0)).toBe(1)
    expect(squeezeScale(1000)).toBeCloseTo(0.9)
    expect(squeezeScale(-1e6)).toBeCloseTo(0.7)
    expect(squeezeScale(1000, 0)).toBe(1)
  })

  it('centerOn подвозит ячейку в центр', () => {
    expect(centerOn({ x: 0, y: 0, width: 100, height: 100 }, 1000, 800)).toEqual({ x: 450, y: 350 })
  })
})
