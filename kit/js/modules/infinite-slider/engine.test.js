import { describe, expect, it } from 'vitest'
import { createInfiniteEngine, nearestIndex, slideOffset, springFrom, springStep } from './engine.js'

const run = (engine, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) engine.step(dt)
}

describe('sliders/infinite/engine', () => {
  it('slideOffset заворачивает ленту вокруг центра', () => {
    expect(slideOffset(0, 0, 100, 8)).toBe(0)
    expect(slideOffset(1, 0, 100, 8)).toBe(100)
    expect(slideOffset(7, 0, 100, 8)).toBe(-100)
    expect(slideOffset(0, -150, 100, 8)).toBe(-150)
  })

  it('nearestIndex', () => {
    expect(nearestIndex(0, 100, 8)).toBe(0)
    expect(nearestIndex(-140, 100, 8)).toBe(1)
    expect(nearestIndex(100, 100, 8)).toBe(7)
  })

  it('пружина сходится к цели; bounce даёт перелёт', () => {
    const calm = springFrom(0.5, 0)
    const bouncy = springFrom(0.5, 1)
    let a = { x: 0, v: 0 }
    let b = { x: 0, v: 0 }
    let overshoot = 0

    for (let i = 0; i < 300; i++) {
      a = springStep(a.x, a.v, 100, 1 / 60, calm)
      b = springStep(b.x, b.v, 100, 1 / 60, bouncy)
      overshoot = Math.max(overshoot, b.x - 100)
    }
    expect(a.x).toBeCloseTo(100, 1)
    expect(overshoot).toBeGreaterThan(1)
    expect(calm.zeta).toBe(1)
  })

  it('shift и goTo доводят до слайда и засыпают', () => {
    const engine = createInfiniteEngine({ count: 8, size: 100 })

    expect(engine.settled).toBe(true)
    expect(engine.step(1 / 60)).toBe(false)
    engine.shift(1)
    expect(engine.targetIndex).toBe(1)
    run(engine, 3)
    expect(engine.index).toBe(1)
    expect(engine.settled).toBe(true)
    expect(engine.position).toBe(-100)

    engine.goTo(7)
    expect(engine.targetIndex).toBe(7)
    run(engine, 3)
    // Кратчайший путь: с 1 на 7 — назад через 0, а не вперёд на 6.
    expect(engine.position).toBe(100)
  })

  it('перетаскивание с лагом и бросок с проекцией', () => {
    const engine = createInfiniteEngine({ count: 8, size: 100, lag: 0.05 })

    engine.press()
    engine.drag(-60)
    expect(engine.dragging).toBe(true)
    engine.step(1 / 60)
    expect(engine.position).toBeLessThan(0)
    expect(engine.position).toBeGreaterThan(-60)
    expect(engine.speed).toBeLessThan(0)

    engine.release(-1500)
    expect(engine.dragging).toBe(false)
    // -60 + (-1500 × 0.22) = -390 → слайд 4.
    expect(engine.targetIndex).toBe(4)
    run(engine, 4)
    expect(engine.index).toBe(4)
  })

  it('drag без press сам начинает жест; lag 0 — сразу за рукой', () => {
    const engine = createInfiniteEngine({ count: 5, size: 50, lag: 0 })

    engine.drag(-30)
    engine.step(1 / 60)
    expect(engine.position).toBe(-30)
    engine.release()
    run(engine, 3)
    expect(engine.position).toBe(-50)
  })

  it('setSize сохраняет текущий слайд', () => {
    const engine = createInfiniteEngine({ count: 6, size: 100 })

    engine.shift(2)
    run(engine, 3)
    engine.setSize(200)
    expect(engine.size).toBe(200)
    expect(engine.position).toBe(-400)
    expect(engine.index).toBe(2)
    engine.setSize(0)
    expect(engine.size).toBe(200)
    engine.setSpring(0.3, 0)
    expect(engine.offset(2)).toBe(0)
  })
})
