/**
 * Счётчик: число «набегает» от 0 до значения, когда блок появляется на экране.
 *
 *   <span class="counter" data-module="counter">1 500</span>
 *   <span data-module="counter" data-counter-decimals="1" data-counter-suffix="%">98.5</span>
 *
 * Итоговое число пишется прямо в разметке — его видят поисковики, читалки и
 * пользователи без JS. Модуль читает его из текста (пробелы, запятые
 * допускаются) или из data-counter-to.
 *
 * Баг, закрытый здесь: ширина числа меняется при счёте («1» уже, чем «8»), и
 * соседний текст дёргается. В стилях .counter — font-variant-numeric: tabular-nums,
 * а на время анимации фиксируем min-width по конечному значению.
 * @module kit/modules/counter
 */
import { gsap } from '../../core/gsap.js'
import { onViewport } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'

const DEFAULTS = {
  /** Конечное значение. NaN — взять из текста элемента. */
  to: NaN,
  from: 0,
  duration: 2,
  decimals: 0,
  prefix: '',
  suffix: '',
  /** Локаль для разделителей тысяч: 'ru-RU' → «1 500». */
  locale: 'ru-RU',
}

/** «1 500,5 ₽» → 1500.5 */
export function parseNumber(text) {
  const cleaned = String(text)
    .replace(/\s/g, '') // \s ловит и неразрывные пробелы (\u00a0, \u202f) из Intl
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  return parseFloat(cleaned)
}

export function formatNumber(value, { decimals = 0, locale = 'ru-RU', prefix = '', suffix = '' } = {}) {
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
  return `${prefix}${text}${suffix}`
}

export default function counter(el, ctx = {}) {
  const options = readOptions(el, 'counter', DEFAULTS, ctx.options)
  const target = Number.isFinite(options.to) ? options.to : parseNumber(el.textContent)
  if (!Number.isFinite(target)) {
    console.warn('[kit] counter: не нашёл число в тексте', el)
    return
  }
  const format = (v) => formatNumber(v, options)
  const final = format(target)
  if (ctx.reduced) {
    el.textContent = final
    return
  }

  el.setAttribute('aria-label', final) // скринридер сразу читает итог, а не «0, 12, 57…»
  el.style.minWidth = `${final.length}ch`
  const state = { value: options.from }
  el.textContent = format(state.value)

  let tween = null
  const stop = onViewport(el, {
    once: true,
    threshold: 0.5,
    enter: () => {
      tween = gsap.to(state, {
        value: target,
        duration: options.duration,
        ease: 'power2.out',
        onUpdate: () => (el.textContent = format(state.value)),
        onComplete: () => (el.style.minWidth = ''),
      })
    },
  })

  return {
    destroy() {
      stop()
      tween?.kill()
      el.textContent = final
      el.style.minWidth = ''
    },
  }
}
