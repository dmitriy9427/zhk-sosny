/**
 * Поле количества с кнопками − и +.
 *
 *   <div class="stepper" data-module="stepper">
 *     <button type="button" data-stepper-dec aria-label="Меньше">−</button>
 *     <input type="number" name="qty" value="1" min="1" max="10" step="1">
 *     <button type="button" data-stepper-inc aria-label="Больше">+</button>
 *   </div>
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. 0.1 + 0.2 = 0.30000000000000004 — округляем до точности шага.
 * 2. Значение вне min/max после ручного ввода — поправляем при уходе с поля.
 * 3. Изменения кнопками не видит форма/фреймворк — шлём input и change,
 *    как при вводе с клавиатуры.
 * 4. Кнопки на краях диапазона активны — блокируем.
 * @module kit/modules/stepper
 */
import { createDisposer } from '../../core/lifecycle.js'

/** Новое значение: шаг в сторону direction, в пределах min/max, без хвостов 0.000…1. */
export function stepValue(value, direction, { min = -Infinity, max = Infinity, step = 1 } = {}) {
  const decimals = (String(step).split('.')[1] ?? '').length
  const base = Number.isFinite(value) ? value : Number.isFinite(min) ? min : 0
  const next = Math.min(max, Math.max(min, base + direction * step))
  return Number(next.toFixed(decimals))
}

export default function stepper(root) {
  const input = root.querySelector('input')
  const dec = root.querySelector('[data-stepper-dec]')
  const inc = root.querySelector('[data-stepper-inc]')
  if (!input) throw new Error('[kit] stepper: нужен <input type="number"> внутри')
  const d = createDisposer()
  const limits = () => ({
    min: input.min === '' ? -Infinity : Number(input.min),
    max: input.max === '' ? Infinity : Number(input.max),
    step: Number(input.step) || 1,
  })
  const value = () => (input.value === '' ? NaN : Number(input.value))

  const sync = () => {
    const { min, max } = limits()
    if (dec) dec.disabled = value() <= min
    if (inc) inc.disabled = value() >= max
  }
  const set = (next) => {
    if (next === value()) return
    input.value = String(next)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    sync()
  }

  if (dec) d.listen(dec, 'click', () => set(stepValue(value(), -1, limits())))
  if (inc) d.listen(inc, 'click', () => set(stepValue(value(), 1, limits())))
  d.listen(input, 'input', sync)
  d.listen(input, 'blur', () => {
    if (input.value === '') return
    set(stepValue(value(), 0, limits()))
  })
  if (input.form) d.listen(input.form, 'reset', () => setTimeout(sync))
  sync()
  return { increment: () => inc?.click(), decrement: () => dec?.click(), destroy: d.dispose }
}
