/**
 * Управление частотой вызовов.
 *
 * debounce — «вызови, когда перестанут дёргать» (поиск по вводу, resize).
 * throttle — «не чаще раза в N мс» (scroll, mousemove).
 * rafThrottle — «не чаще раза в кадр» (всё, что меняет вёрстку на scroll/pointermove).
 * @module kit/core/timing
 */

export function debounce(fn, wait = 150) {
  let timer
  const debounced = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
  debounced.cancel = () => clearTimeout(timer)
  return debounced
}

export function throttle(fn, wait = 100) {
  let last = 0
  let timer
  let pendingArgs
  const throttled = (...args) => {
    const now = Date.now()
    const remaining = wait - (now - last)
    pendingArgs = args
    if (remaining <= 0) {
      clearTimeout(timer)
      timer = undefined
      last = now
      fn(...args)
    } else if (!timer) {
      // Последний вызов не теряем: выполним его в конце окна.
      timer = setTimeout(() => {
        last = Date.now()
        timer = undefined
        fn(...pendingArgs)
      }, remaining)
    }
  }
  throttled.cancel = () => {
    clearTimeout(timer)
    timer = undefined
  }
  return throttled
}

export function rafThrottle(fn) {
  let frame = 0
  let lastArgs
  const throttled = (...args) => {
    lastArgs = args
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      fn(...lastArgs)
    })
  }
  throttled.cancel = () => {
    cancelAnimationFrame(frame)
    frame = 0
  }
  return throttled
}

/** Подождать N мс. */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Дождаться следующего кадра (после того как браузер применил стили). */
/** @returns {Promise<void>} */
export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
