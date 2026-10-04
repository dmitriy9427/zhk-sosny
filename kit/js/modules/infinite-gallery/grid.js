/**
 * Математика бесконечной сетки — чистые функции (тесты — grid.test.js).
 *
 * columnSpeed(i, cols, step) — скорость колонки ячейки i по вертикали:
 *   первая колонка 1, следующая 1 − step, … — дальние колонки отстают, и
 *   сетка выглядит объёмной.
 * wrapCell(base, offset, size, total) — позиция ячейки с заворотом по модулю
 *   размера сетки. Диапазон [−size, total − size): ячейка переносится на
 *   другую сторону, только когда ЦЕЛИКОМ ушла за край (не мигает на краю).
 * velocityUnit(lag)  — «скорость» −1…1 из отставания (для наклона карточек).
 * squeezeScale(lag)  — масштаб карточек на скорости (до −30%).
 * centerOn(cell, w, h) — на сколько сдвинуть сетку, чтобы ячейка встала в центр.
 *
 * Условие «без дыр»: число ячеек кратно числу колонок (все ряды полные),
 * а сетка больше окна хотя бы на одну ячейку по каждой оси. См. index.js.
 * @module kit/modules/infinite-gallery/grid
 */
import { clamp, wrap } from '../../core/math.js'

/**
 * Скорость колонки по вертикали: дальние колонки отстают — появляется глубина.
 * @param {number} index Номер ячейки.
 * @param {number} columns
 * @param {number} step Разница скоростей соседних колонок.
 */
export const columnSpeed = (index, columns, step) => 1 - (index % columns) * step

/**
 * Положение ячейки с заворотом: ушла за один край сетки — появилась с
 * другого. Диапазон [−size, total − size), чтобы ячейка заворачивалась,
 * только целиком уйдя за край.
 */
export const wrapCell = (base, offset, size, total) => wrap(base + offset, -size, total - size)

/** Отставание сетки от руки (px), при котором эффекты выходят на полную силу. */
export const VELOCITY_FULL = 600

/** Отставание → −1…1 для наклона и прочих эффектов. */
export const velocityUnit = (lag) => clamp(lag / VELOCITY_FULL, -1, 1)

/**
 * Масштаб карточек на скорости: 1000 px отставания — минус 10% при
 * `amount = 1`; не меньше `1 − max`, чтобы рывок не схлопнул карточки.
 */
export const squeezeScale = (lag, amount = 1, max = 0.3) => 1 - Math.min(Math.abs(lag) * 0.0001 * amount, max)

/** Пиксельный сдвиг, чтобы ячейка встала в центр окна. */
export function centerOn(cell, viewportWidth, viewportHeight) {
  return {
    x: viewportWidth / 2 - (cell.x + cell.width / 2),
    y: viewportHeight / 2 - (cell.y + cell.height / 2),
  }
}
