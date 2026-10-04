/**
 * Окружение: что умеет устройство и чего хочет пользователь.
 *
 * ─── Брейкпоинты: один источник правды ─────────────────────────────────────
 * Брейкпоинты задаются ОДИН раз в SCSS (kit/scss/_config.scss, карта
 * $breakpoints). SCSS выводит их в CSS-переменные `--bp-md: 768px` на :root,
 * а JS читает их оттуда. Так JS и CSS не разъедутся (классический баг: в CSS
 * мобилка до 767px, а в JS до 768px, и на ширине 768 ломается всё).
 * DEFAULT_BREAKPOINTS — запасные значения, если CSS ещё не подключён (тесты);
 * тест kit/scss/scss.test.js проверяет, что они совпадают с SCSS.
 * @module kit/core/env
 */

export const DEFAULT_BREAKPOINTS = Object.freeze({ sm: 576, md: 768, lg: 1024, xl: 1280, xxl: 1440 })

const mq = (query) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null)

/** Пользователь просил меньше анимаций (системная настройка). Анимации обязаны это уважать. */
export const prefersReducedMotion = () => Boolean(mq('(prefers-reduced-motion: reduce)')?.matches)

/** Есть ли «настоящий» hover (мышь). На тач-экранах hover залипает — не полагаемся на него. */
export const canHover = () => Boolean(mq('(hover: hover) and (pointer: fine)')?.matches)

/** Основной указатель — палец. */
export const isTouch = () => Boolean(mq('(pointer: coarse)')?.matches)

/**
 * Брейкпоинты из CSS-переменных (или запасные).
 * @returns {Record<string, number>}
 */
export function getBreakpoints() {
  if (typeof document === 'undefined') return { ...DEFAULT_BREAKPOINTS }
  const style = getComputedStyle(document.documentElement)
  /** @type {Record<string, number>} */
  const result = {}
  for (const [name, fallback] of Object.entries(DEFAULT_BREAKPOINTS)) {
    const value = parseFloat(style.getPropertyValue(`--bp-${name}`))
    result[name] = Number.isFinite(value) ? value : fallback
  }
  return result
}

/**
 * Медиазапрос «от брейкпоинта и шире» (mobile-first, как mixin up() в SCSS).
 * @param {string} name 'md' | 'lg' | …
 */
export function upQuery(name) {
  const value = getBreakpoints()[name]
  if (value === undefined) throw new Error(`[kit] нет брейкпоинта «${name}»`)
  return `(min-width: ${value}px)`
}

/**
 * Следить за медиазапросом. Сразу вызывает fn с текущим состоянием.
 *   const off = watchMedia(upQuery('lg'), (isDesktop) => …)
 * @returns {() => void} отписка
 */
export function watchMedia(query, fn) {
  const list = mq(query)
  if (!list) {
    fn(false)
    return () => {}
  }
  const handler = () => fn(list.matches)
  handler()
  list.addEventListener('change', handler)
  return () => list.removeEventListener('change', handler)
}
