/**
 * Математика для анимаций. Все функции чистые — легко тестировать.
 * @module kit/core/math
 */

/** Ограничить значение диапазоном [min, max]. */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/** Точка между a и b: t=0 → a, t=1 → b. */
export const lerp = (a, b, t) => a + (b - a) * t

/** Перевести value из диапазона [inMin, inMax] в [outMin, outMax] (с ограничением). */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin
  return lerp(outMin, outMax, clamp((value - inMin) / (inMax - inMin), 0, 1))
}

/** «По кругу»: wrap(5, 0, 4) → 1. Основа бесконечных лент и зацикленных слайдеров. */
export function wrap(value, min, max) {
  const range = max - min
  if (range === 0) return min
  return ((((value - min) % range) + range) % range) + min
}

/**
 * Плавное догоняние цели, НЕ зависящее от частоты кадров.
 * Обычный `x += (target - x) * 0.1` на 120 Гц экране работает вдвое быстрее,
 * чем на 60 Гц. damp учитывает время кадра dt (в секундах).
 * @param {number} lambda «Скорость»: 5 — мягко, 20 — почти сразу.
 */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Округлить до знаков после запятой. */
export const round = (value, digits = 0) => {
  const k = 10 ** digits
  return Math.round(value * k) / k
}

/** Остаток, всегда неотрицательный: mod(-1, 5) → 4 (обычный % дал бы -1). */
export const mod = (n, m) => ((n % m) + m) % m

/** Градусы → радианы. */
export const rad = (deg) => (deg * Math.PI) / 180
