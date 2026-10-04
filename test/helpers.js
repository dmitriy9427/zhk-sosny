/**
 * Помощники для тестов модулей.
 */
import { createBus } from '../kit/js/core/bus.js'

/** Вставить HTML в документ и вернуть первый элемент. */
export function html(markup) {
  document.body.insertAdjacentHTML('beforeend', markup.trim())
  return document.body.lastElementChild
}

/** Контекст модуля как в приложении, но без плавного скролла. */
export const createCtx = (extra = {}) => ({ bus: createBus(), reduced: true, scroll: null, ...extra })

/** Подождать завершения микрозадач/таймеров. */
export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

/** Нажатие клавиши на элементе. */
export const key = (el, k, extra = {}) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra }))

/** Задать «размеры» элементу (в jsdom они всегда 0). */
export function setSize(el, { width = 0, height = 0, scrollWidth = width, scrollHeight = height } = {}) {
  Object.defineProperties(el, {
    offsetWidth: { configurable: true, value: width },
    offsetHeight: { configurable: true, value: height },
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
    scrollWidth: { configurable: true, value: scrollWidth },
    scrollHeight: { configurable: true, value: scrollHeight },
  })
  el.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width, height, right: width, bottom: height })
  return el
}
