/**
 * Настройки модуля из data-атрибутов.
 *
 *   <div data-module="marquee" data-marquee-speed="80" data-marquee-reverse>
 *   readOptions(el, 'marquee', { speed: 50, reverse: false, pauseOnHover: true })
 *   → { speed: 80, reverse: true, pauseOnHover: true }
 *
 * Правила:
 * - атрибут `data-<модуль>-<ключ-через-дефис>` → ключ в camelCase
 *   (data-marquee-pause-on-hover → pauseOnHover);
 * - ТИП берётся из значения по умолчанию. Поэтому у каждой настройки обязано
 *   быть значение по умолчанию — иначе непонятно, "5" это строка или число;
 * - boolean: атрибут без значения или "true"/"" → true, "false" → false;
 * - объект/массив: JSON ('{"a":1}' / '[1,2]');
 * - `overrides` (из JS или React) важнее атрибутов.
 *
 * Частый баг, который здесь закрыт: `data-x-enabled="false"` в «наивном»
 * коде превращается в true (непустая строка). Здесь — в false.
 * @module kit/core/options
 */

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/**
 * Привести строку из атрибута к типу значения по умолчанию.
 * @param {string} raw
 * @param {*} fallback
 */
export function coerce(raw, fallback) {
  switch (typeof fallback) {
    case 'boolean':
      return raw !== 'false' && raw !== '0'
    case 'number': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : fallback
    }
    case 'object':
      if (fallback === null) return raw
      try {
        return JSON.parse(raw)
      } catch {
        console.warn(`[kit] не удалось прочитать JSON «${raw}», взято значение по умолчанию`)
        return fallback
      }
    default:
      return raw
  }
}

/**
 * @template T
 * @param {HTMLElement} el
 * @param {string} name Имя модуля (префикс атрибутов).
 * @param {T} defaults Значения по умолчанию — задают и список ключей, и типы.
 * @param {Partial<T> & Record<string, any>} [overrides]
 * @returns {T}
 */
export function readOptions(el, name, defaults, overrides = {}) {
  /** @type {any} */
  const result = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const attr = `data-${name}-${kebab(key)}`
    if (el.hasAttribute(attr)) result[key] = coerce(el.getAttribute(attr), defaults[key])
  }
  // Предупреждаем о незнакомых атрибутах — обычно это опечатка (data-marque-speed).
  for (const attr of el.getAttributeNames()) {
    const prefix = `data-${name}-`
    if (attr.startsWith(prefix) && !Object.hasOwn(/** @type {object} */ (defaults), camel(attr.slice(prefix.length)))) {
      console.warn(`[kit] ${name}: неизвестная настройка «${attr}». Есть: ${Object.keys(defaults).join(', ')}`)
    }
  }
  return Object.assign(result, overrides)
}
