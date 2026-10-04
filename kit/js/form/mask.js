/**
 * Маски ввода: телефон, дата, время, ИНН, СНИЛС, индекс, паспорт, число, свой шаблон.
 *
 *   <input data-mask="phone">                      +7 (912) 345-67-89
 *   <input data-mask="date">                       31.12.2025
 *   <input data-mask="number" data-mask-decimals="2">  1 500 000,50
 *   <input data-mask-pattern="AA-999">             свой шаблон: AB-123
 *
 * В шаблоне: 9 — цифра, A — буква (рус./лат.), * — буква или цифра; всё
 * остальное — постоянные символы, которые маска подставляет сама.
 *
 * Внутри <form data-module="form"> маски включаются сами. Вне формы —
 * data-module="mask" на поле.
 *
 * ─── Баги масок, закрытые здесь ─────────────────────────────────────────────
 * 1. Курсор прыгает в конец при правке середины номера. Запоминаем, сколько
 *    «значимых» символов (цифр) было до курсора, и ставим курсор после
 *    стольких же в новом значении.
 * 2. Backspace «застревает» на скобке/дефисе: удаляется «-», маска тут же
 *    возвращает его. Если слева от курсора постоянный символ — перескакиваем
 *    его и удаляем цифру перед ним.
 * 3. Вставка «8 (912) 345 67 89» или «+7912…» ломает номер: для телефона
 *    первая 7/8 одиннадцатизначного номера — код страны, он отбрасывается.
 * 4. Мобильная клавиатура с буквами для цифрового поля — ставим inputmode.
 * 5. Автозаполнение браузера (autocomplete="tel") присылает номер целиком —
 *    обрабатывается так же, как вставка.
 * @module kit/form/mask
 */

const TOKENS = {
  9: /\d/,
  A: /[a-zа-яё]/i,
  '*': /[\da-zа-яё]/i,
}

/** Готовые маски. min — сколько значимых символов достаточно (ИНН: 10 или 12). */
export const MASKS = {
  phone: { pattern: '+7 (999) 999-99-99', inputmode: 'tel' },
  date: { pattern: '99.99.9999', inputmode: 'numeric' },
  time: { pattern: '99:99', inputmode: 'numeric' },
  inn: { pattern: '999999999999', min: 10, inputmode: 'numeric' },
  snils: { pattern: '999-999-999 99', inputmode: 'numeric' },
  postcode: { pattern: '999999', inputmode: 'numeric' },
  passport: { pattern: '99 99 999999', inputmode: 'numeric' },
}

/**
 * Создать маску по шаблону.
 * @param {string} pattern
 * @param {{ min?: number, prepare?: (chars: string) => string }} [o]
 */
export function createMask(pattern, { min, prepare } = {}) {
  const slots = [...pattern].map((c) => TOKENS[c] ?? null) // null — постоянный символ
  const total = slots.filter(Boolean).length
  // Постоянное начало шаблона («+7 (») — его символы не считаются вводом.
  const prefixLength = slots.findIndex(Boolean)
  const prefix = pattern.slice(0, prefixLength)

  /** Значимые символы из любой строки (с маской или без). */
  function extract(value) {
    let text = String(value)
    // Стёрли до «+7 (» или «+7» — это пустое поле, а не цифра 7.
    if (prefix && prefix.startsWith(text)) return ''
    if (prefix && text.startsWith(prefix.trimEnd())) text = text.slice(prefix.trimEnd().length)
    const any = TOKENS['*']
    let chars = [...text].filter((c) => any.test(c)).join('')
    if (prepare) chars = prepare(chars)
    return chars
  }

  /** Отформатировать строку по шаблону. */
  function format(value) {
    const chars = [...extract(value)]
    let out = ''
    let i = 0
    for (let p = 0; p < slots.length && i < chars.length; p++) {
      const slot = slots[p]
      if (!slot) {
        out += pattern[p]
        continue
      }
      // Пропускаем символы, которые не подходят к этому месту (буква вместо цифры).
      while (i < chars.length && !slot.test(chars[i])) i++
      if (i < chars.length) out += chars[i++]
    }
    return out
  }

  /** Сколько значимых символов в отформатированной строке. */
  const filled = (value) => [...format(value)].filter((c, i) => slots[i]).length

  return {
    pattern,
    format,
    /** Только значимые символы: '+7 (912) 345-67-89' → '9123456789'. */
    unmask: (value) => [...format(value)].filter((_, i) => slots[i]).join(''),
    /** Заполнена ли маска (для ИНН — хотя бы min символов). */
    isComplete: (value) => {
      const n = filled(value)
      return n === total || (min !== undefined && n === min)
    },
    /** Позиция в строке после n-го значимого символа (для курсора). */
    caretAfter(value, n) {
      if (n === 0) return Math.min(prefixLength, value.length)
      let count = 0
      for (let i = 0; i < value.length; i++) {
        if (slots[i] && ++count === n) return i + 1
      }
      return value.length
    },
    /** Сколько значимых символов до позиции pos. */
    countBefore: (value, pos) => extract(String(value).slice(0, pos)).length,
    /** Постоянный ли символ на позиции (для Backspace). */
    isLiteral: (index) => index >= 0 && index < slots.length && !slots[index],
    prefixLength,
  }
}

/** Маска телефона: 11-значный номер с 7/8 в начале → без кода страны. */
const phonePrepare = (chars) => (chars.length > 10 && /^[78]/.test(chars) ? chars.slice(1) : chars)

/**
 * Числовая маска с разрядами: 1500000,5 → «1 500 000,5».
 * @param {{ decimals?: number }} [o]
 */
export function createNumberMask({ decimals = 0 } = {}) {
  const format = (value) => {
    let text = String(value)
      .replace(/[^\d.,-]/g, '')
      .replace('.', ',')
    const negative = text.startsWith('-')
    text = text.replace(/-/g, '')
    let [int = '', frac] = text.split(',')
    int = int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
    const sign = negative ? '-' : ''
    if (frac === undefined || decimals === 0) return sign + int
    return `${sign}${int},${frac.replace(/,/g, '').slice(0, decimals)}`
  }
  const isDigit = (c) => /\d/.test(c)
  return {
    pattern: 'number',
    format,
    unmask: (value) =>
      format(value)
        .replace(/\u00a0/g, '')
        .replace(',', '.'),
    isComplete: () => true,
    countBefore: (value, pos) => [...String(value).slice(0, pos)].filter(isDigit).length,
    caretAfter(value, n) {
      let count = 0
      for (let i = 0; i < value.length; i++) if (isDigit(value[i]) && ++count === n) return i + 1
      return n === 0 ? 0 : value.length
    },
    isLiteral: () => false,
    prefixLength: 0,
  }
}

/** Маска по имени или шаблону из атрибутов поля. */
export function maskFor(input) {
  const { mask: name, maskPattern, maskDecimals } = input.dataset
  if (maskPattern) return createMask(maskPattern)
  if (name === 'number') return createNumberMask({ decimals: Number(maskDecimals) || 0 })
  const preset = MASKS[name]
  if (!preset) {
    if (name) console.warn(`[kit] mask: нет маски «${name}». Есть: ${[...Object.keys(MASKS), 'number'].join(', ')}`)
    return null
  }
  return createMask(preset.pattern, { min: preset.min, prepare: name === 'phone' ? phonePrepare : undefined })
}

const attached = new WeakMap()

/**
 * Подключить маску к полю. Повторный вызов на том же поле ничего не делает
 * (поле может оказаться и в форме, и с data-module="mask").
 * @returns {{ mask: object, destroy: () => void } | null}
 */
export function attachMask(input, mask = maskFor(input)) {
  if (!mask) return null
  if (attached.has(input)) return attached.get(input)

  const preset = MASKS[input.dataset.mask]
  if (preset?.inputmode && !input.hasAttribute('inputmode')) input.inputMode = preset.inputmode
  if (input.dataset.mask === 'number' && !input.hasAttribute('inputmode')) input.inputMode = 'decimal'
  // maxlength НЕ ставим: вставка «8 (912) 345 67 89 доб.» обрезалась бы браузером
  // раньше, чем маска её разберёт. Длину и так ограничивает шаблон.

  const apply = () => {
    const pos = input.selectionStart ?? input.value.length
    const atEnd = pos === input.value.length
    const before = mask.countBefore(input.value, pos)
    const next = mask.format(input.value)
    if (next === input.value) return
    input.value = next
    // Курсор: в конец, если печатали в конце; иначе — после того же числа цифр.
    const caret = atEnd ? next.length : mask.caretAfter(next, before)
    if (document.activeElement === input) input.setSelectionRange(caret, caret)
  }

  const onKeydown = (event) => {
    if (event.key !== 'Backspace' || input.selectionStart !== input.selectionEnd) return
    let pos = input.selectionStart
    if (!mask.isLiteral(pos - 1) || pos <= mask.prefixLength) return
    // Перескакиваем постоянные символы влево, чтобы Backspace удалил цифру.
    while (pos > mask.prefixLength && mask.isLiteral(pos - 1)) pos--
    input.setSelectionRange(pos, pos)
  }

  input.addEventListener('input', apply)
  input.addEventListener('keydown', onKeydown)
  if (input.value) input.value = mask.format(input.value)

  const handle = {
    mask,
    destroy() {
      input.removeEventListener('input', apply)
      input.removeEventListener('keydown', onKeydown)
      attached.delete(input)
    },
  }
  attached.set(input, handle)
  return handle
}

/** Маска, подключённая к полю (или undefined). */
export const getMask = (input) => attached.get(input)?.mask
