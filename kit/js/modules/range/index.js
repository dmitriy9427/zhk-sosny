/**
 * Ползунок диапазона «от — до» (цена, площадь, этаж).
 *
 *   <div class="range" data-module="range" data-range-format="price">
 *     <div class="range__track">
 *       <input type="range" name="priceMin" min="3000000" max="25000000" step="100000" value="3000000" aria-label="Цена от">
 *       <input type="range" name="priceMax" min="3000000" max="25000000" step="100000" value="25000000" aria-label="Цена до">
 *     </div>
 *     <p class="range__values"><output data-range-min></output><output data-range-max></output></p>
 *   </div>
 *
 * Одна ручка — один <input type="range">: работает с клавиатуры, читается
 * скринридером, отправляется в форме, без JS остаются два обычных ползунка.
 * Модуль накладывает их друг на друга, рисует заливку между ручками и
 * не даёт ручкам «перепрыгнуть» друг через друга.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Ручки сошлись в одну точку у правого края — верхний ползунок перекрывает
 *    нижний, и ручки уже не развести. Сверху всегда та ручка, которую можно
 *    двигать (z-index меняется по положению).
 * 2. Значения уходят «за» соседнюю ручку — min не больше max и наоборот.
 * 3. Изменения из кода (сброс фильтра) не видны — слушаем input и change,
 *    а также reset формы.
 * 4. Пользователь хочет ввести точное число — подключите <input type="number">
 *    с data-range-input="min|max": значения синхронизируются в обе стороны.
 * Событие range:change { min, max } — после отпускания ручки (для фильтров).
 * @module kit/modules/range
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { getLocale } from '../../core/i18n.js'

const DEFAULTS = {
  /** Формат подписи: 'number' | 'price' | 'area' | '' (как есть). */
  format: 'number',
  /** Суффикс подписи (если format не задаёт свой). */
  suffix: '',
}

/** Подпись значения по формату. */
export function formatRangeValue(value, format = 'number', suffix = '', locale = 'ru') {
  const n = Number(value)
  if (format === 'price') {
    return n >= 1e6
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n / 1e6)} ${locale === 'ru' ? 'млн ₽' : 'M ₽'}`
      : `${new Intl.NumberFormat(locale).format(n)} ₽`
  }
  if (format === 'area') return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)} м²`
  if (format === 'number') return `${new Intl.NumberFormat(locale).format(n)}${suffix}`
  return `${value}${suffix}`
}

/** Положение значения на шкале, 0…100 %. */
export const percentOf = (value, min, max) => (max === min ? 0 : ((value - min) / (max - min)) * 100)

export default function range(root, ctx = {}) {
  const options = readOptions(root, 'range', DEFAULTS, ctx.options)
  const [low, high] = root.querySelectorAll('input[type="range"]')
  if (!low || !high) throw new Error('[kit] range: нужны два <input type="range"> внутри')
  const d = createDisposer()
  const outMin = root.querySelector('[data-range-min]')
  const outMax = root.querySelector('[data-range-max]')
  const numMin = root.querySelector('[data-range-input="min"]')
  const numMax = root.querySelector('[data-range-input="max"]')
  root.classList.add('is-ready')

  const bounds = () => ({ min: Number(low.min), max: Number(low.max) })

  function render() {
    const { min, max } = bounds()
    const a = Number(low.value)
    const b = Number(high.value)
    root.style.setProperty('--from', `${percentOf(a, min, max)}%`)
    root.style.setProperty('--to', `${percentOf(b, min, max)}%`)
    // Баг 1: ручки сошлись. Верхняя ручка по умолчанию — правая (она позже в
    // DOM), но в правой половине шкалы её можно тянуть только вправо — некуда.
    // Тогда поднимаем левую: её можно увести влево.
    low.style.zIndex = a >= b && a > (min + max) / 2 ? '3' : '1'
    const locale = getLocale()
    if (outMin) outMin.textContent = formatRangeValue(a, options.format, options.suffix, locale)
    if (outMax) outMax.textContent = formatRangeValue(b, options.format, options.suffix, locale)
    if (numMin && document.activeElement !== numMin) numMin.value = String(a)
    if (numMax && document.activeElement !== numMax) numMax.value = String(b)
    low.setAttribute('aria-valuetext', outMin?.textContent ?? String(a))
    high.setAttribute('aria-valuetext', outMax?.textContent ?? String(b))
  }

  // Баг 2: ручки не проходят друг через друга.
  d.listen(low, 'input', () => {
    if (Number(low.value) > Number(high.value)) low.value = high.value
    render()
  })
  d.listen(high, 'input', () => {
    if (Number(high.value) < Number(low.value)) high.value = low.value
    render()
  })

  const emit = () =>
    root.dispatchEvent(new CustomEvent('range:change', { bubbles: true, detail: { min: Number(low.value), max: Number(high.value) } }))
  d.listen(low, 'change', emit)
  d.listen(high, 'change', emit)

  // Баг 4: точный ввод числом.
  const fromNumber = (input, slider, isMin) => () => {
    const { min, max } = bounds()
    let value = Math.min(max, Math.max(min, Number(input.value) || 0))
    if (isMin) value = Math.min(value, Number(high.value))
    else value = Math.max(value, Number(low.value))
    slider.value = String(value)
    render()
    emit()
  }
  if (numMin) d.listen(numMin, 'change', fromNumber(numMin, low, true))
  if (numMax) d.listen(numMax, 'change', fromNumber(numMax, high, false))

  // Баг 3: reset формы.
  const form = low.form
  if (form) d.listen(form, 'reset', () => setTimeout(render))

  render()
  return {
    get value() {
      return { min: Number(low.value), max: Number(high.value) }
    },
    /** Задать значения из кода (например, из адресной строки). */
    set(min, max) {
      if (min !== undefined) low.value = String(min)
      if (max !== undefined) high.value = String(max)
      render()
    },
    render,
    destroy() {
      d.dispose()
      root.classList.remove('is-ready')
    },
  }
}
