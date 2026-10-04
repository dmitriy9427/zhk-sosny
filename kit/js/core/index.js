/**
 * Ядро: всё, что нужно модулям и приложению, одним импортом.
 *   import { createApp, createDisposer, readOptions } from 'kit/js/core'
 * @module kit/core
 */
export { createApp } from './app.js'
export { createBus } from './bus.js'
export { delegate, ensureId, focusable, qs, qsa, trapFocus, uid } from './dom.js'
export {
  DEFAULT_BREAKPOINTS,
  canHover,
  getBreakpoints,
  isTouch,
  prefersReducedMotion,
  upQuery,
  watchMedia,
} from './env.js'
export { createDisposer, onViewport } from './lifecycle.js'
export { clamp, damp, lerp, mapRange, round, wrap } from './math.js'
export { coerce, readOptions } from './options.js'
export { getInstance, isLazy, lazy, mount, moduleNames, observe, unmount } from './registry.js'
export { isScrollLocked, lockScroll, resetScrollLock, setScrollEngine, unlockScroll } from './scroll-lock.js'
export { createSmoothScroll, headerOffset } from './smooth-scroll.js'
export { readStorage, removeStorage, writeStorage } from './storage.js'
export { debounce, nextFrame, rafThrottle, throttle, wait } from './timing.js'
