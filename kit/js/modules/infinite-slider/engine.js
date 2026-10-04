/**
 * Движок бесконечной ленты — общий для DOM-версии и WebGL-барабана.
 * Не знает ни про DOM, ни про three.js: принимает жесты, отдаёт смещения.
 * Тесты — engine.test.js.
 *
 * ─── Состояние ──────────────────────────────────────────────────────────────
 * `target` — где лента ДОЛЖНА быть, `current` — где она СЕЙЧАС, `velocity`.
 * Позиция в пикселях: 0 — первый слайд по центру, −size — второй, и т. д.
 *
 * ─── Поведение ──────────────────────────────────────────────────────────────
 * 1. Тянут рукой: target = target + сдвиг руки, current догоняет с
 *    небольшим запаздыванием (lag) — лента «тянется» за пальцем мягко.
 * 2. Отпустили: target = ближайший слайд С УЧЁТОМ БРОСКА (позиция +
 *    скорость × project — сильный бросок пролистывает несколько слайдов).
 *    Дальше current едет к target ПРУЖИНОЙ, подхватив скорость руки —
 *    поэтому нет рывка в момент отпускания.
 * 3. Догнали (меньше 0.05 px и почти без скорости) — `settled`, step()
 *    возвращает false, и рендер можно не вызывать вовсе.
 *
 * ─── Бесконечность ──────────────────────────────────────────────────────────
 * Слайдов конечное число; смещение каждого «заворачивается» по модулю длины
 * ленты (slideOffset) — уехавший влево слайд появляется справа.
 * @module kit/modules/infinite-slider/engine
 */
import { clamp, damp, mod, wrap } from '../../core/math.js'

/**
 * Один шаг пружины (полунеявный Эйлер — устойчив при любом dt кадра).
 * @param {number} x Положение.
 * @param {number} v Скорость.
 * @param {number} target
 * @param {number} dt
 * @param {{ omega: number, zeta: number }} spring
 */
export function springStep(x, v, target, dt, { omega, zeta }) {
  const acceleration = -omega * omega * (x - target) - 2 * zeta * omega * v
  const velocity = v + acceleration * dt

  return { x: x + velocity * dt, v: velocity }
}

/**
 * Параметры пружины из «человеческих»: время доводки и пружинистость.
 * @param {number} duration Секунды, за которые лента в основном садится.
 * @param {number} bounce 0 — без перелёта, 1 — заметный отскок.
 */
export function springFrom(duration, bounce) {
  return { omega: ((2 * Math.PI) / Math.max(duration, 0.05)) * 0.75, zeta: clamp(1 - bounce * 0.7, 0.2, 1) }
}

/**
 * Смещение слайда `index` от центра окна (px), с заворотом по кругу.
 * Отрицательное — левее центра.
 */
export function slideOffset(index, position, size, count) {
  const total = size * count

  return wrap(index * size + position, -total / 2, total / 2)
}

/** Ближайший к центру слайд при данном положении. */
export const nearestIndex = (position, size, count) => mod(Math.round(-position / size), count)

/**
 * @param {{ count: number, size?: number, lag?: number, snapDuration?: number, bounce?: number, project?: number }} options
 *   `project` — сколько секунд броска «проецировать» вперёд при выборе слайда.
 */
export function createInfiniteEngine({
  count,
  size = 1,
  lag = 0.08,
  snapDuration = 0.7,
  bounce = 0.15,
  project = 0.22,
}) {
  let current = 0
  let target = 0
  let velocity = 0
  let dragging = false
  let settled = true
  let spring = springFrom(snapDuration, bounce)
  let slideSize = size

  const snapTarget = (from, throwVelocity = 0) => Math.round((from + throwVelocity * project) / slideSize) * slideSize

  return {
    /** Ширина слайда с зазором, px. Сохраняет текущий слайд при ресайзе. */
    setSize(next) {
      if (next <= 0 || next === slideSize) return
      const ratio = next / slideSize

      current *= ratio
      target *= ratio
      slideSize = next
    },
    get size() {
      return slideSize
    },
    press() {
      dragging = true
      settled = false
      target = current
    },
    /** Сдвинуть ленту рукой/колесом на `dx` px. */
    drag(dx) {
      if (!dragging) this.press()
      target += dx
      settled = false
    },
    /** Отпустили: выбрать слайд с учётом скорости броска (px/с). */
    release(throwVelocity = 0) {
      dragging = false
      velocity = throwVelocity * 0.6 + velocity * 0.4
      target = snapTarget(target, throwVelocity)
      settled = false
    },
    /** Перейти на `steps` слайдов (−1 — назад). */
    shift(steps) {
      target = snapTarget(target) - steps * slideSize
      settled = false
    },
    /** Перейти к слайду `index` ближайшим путём. */
    goTo(index) {
      const from = nearestIndex(target, slideSize, count)
      let delta = mod(index - from, count)

      if (delta > count / 2) delta -= count
      this.shift(delta)
    },
    /** Шаг симуляции. Возвращает true, пока лента движется. */
    step(dt) {
      if (settled) return false

      const before = current

      if (dragging) {
        current = lag > 0 ? damp(current, target, 1 / lag, dt) : target
        velocity = (current - before) / Math.max(dt, 1e-4)
      } else {
        const next = springStep(current, velocity, target, dt, spring)

        current = next.x
        velocity = next.v
        if (Math.abs(current - target) < 0.05 && Math.abs(velocity) < 5) {
          current = target
          velocity = 0
          settled = true
        }
      }
      return !settled
    },
    setSpring(duration, nextBounce) {
      spring = springFrom(duration, nextBounce)
    },
    offset(index) {
      return slideOffset(index, current, slideSize, count)
    },
    get index() {
      return nearestIndex(current, slideSize, count)
    },
    get targetIndex() {
      return nearestIndex(target, slideSize, count)
    },
    get position() {
      return current
    },
    /** Скорость −1…1 (1 — ширина слайда в секунду × 3), для эффектов. */
    get speed() {
      return clamp(velocity / (slideSize * 3), -1, 1)
    },
    get dragging() {
      return dragging
    },
    get settled() {
      return settled
    },
  }
}
