/**
 * Подготовка тестовой среды. jsdom — это DOM без браузерного движка:
 * нет вёрстки, нет matchMedia, нет IntersectionObserver. Добавляем
 * минимальные заменители, чтобы код модулей запускался как в браузере.
 * Подробно — docs/testing.md.
 */
import { afterEach } from 'vitest'

// Тесты с окружением node (SCSS, Vite-плагины, create) браузерные заглушки не нужны.
if (typeof window !== 'undefined') installBrowserStubs()

function installBrowserStubs() {
  // matchMedia: по умолчанию «ничего не совпадает». Тест может переопределить
  // через setMedia({ '(prefers-reduced-motion: reduce)': true }).
  const mediaState = {}
  globalThis.setMedia = (map) => Object.assign(mediaState, map)
  window.matchMedia = (query) => {
    const listeners = new Set()
    return {
      media: query,
      get matches() {
        return Boolean(mediaState[query])
      },
      addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn),
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
    }
  }

  // IntersectionObserver: фейк, которым тест управляет вручную —
  // triggerIntersect(el, true) «показывает» элемент.
  const observers = new Set()
  class FakeIntersectionObserver {
    constructor(callback) {
      this.callback = callback
      this.targets = new Set()
      observers.add(this)
    }
    observe(el) {
      this.targets.add(el)
    }
    unobserve(el) {
      this.targets.delete(el)
    }
    disconnect() {
      this.targets.clear()
      observers.delete(this)
    }
  }
  window.IntersectionObserver = FakeIntersectionObserver
  globalThis.triggerIntersect = (el, isIntersecting = true) => {
    observers.forEach((o) => {
      if (o.targets.has(el))
        o.callback(
          [
            {
              target: el,
              isIntersecting,
              intersectionRatio: isIntersecting ? 1 : 0,
            },
          ],
          o,
        )
    })
  }

  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = function () {}

  // <dialog> в jsdom есть, но без showModal/close.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function (value) {
      if (!this.open) return
      this.open = false
      this.returnValue = value ?? ''
      this.dispatchEvent(new Event('close'))
    }
  }

  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('lang')
    for (const key of Object.keys(mediaState)) delete mediaState[key]
    // Адрес между тестами — чистый (табы и модалки пишут в него состояние).
    history.replaceState(null, '', '/')
  })
}
