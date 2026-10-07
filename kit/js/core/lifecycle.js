/**
 * Уборка за модулем и «блок на экране?».
 *
 * createDisposer() — копилка «как выключить всё, что включил». Главное
 * средство от утечек: обработчиков, которые висят после удаления блока,
 * анимаций, которые крутятся для невидимых элементов.
 *
 *   const d = createDisposer()
 *   d.listen(window, 'resize', onResize)      // повесить и запомнить, как снять
 *   d.add(() => tween.kill())                 // запомнить любую уборку
 *   d.timeout(() => …, 2000)                  // setTimeout, который отменится при destroy
 *   d.interval(() => …, 1000)                 // setInterval — то же
 *   return { destroy: d.dispose }
 *
 * onViewport() — позвать функцию, когда элемент появился/ушёл с экрана.
 * @module kit/core/lifecycle
 */

export function createDisposer() {
  const tasks = []
  let disposed = false

  const api = {
    /** Добавить уборку. Если уборка уже прошла — выполнить сразу (модуль убили, пока он грузился). */
    add(fn) {
      if (typeof fn !== 'function') return fn
      if (disposed) fn()
      else tasks.push(fn)
      return fn
    },
    /** addEventListener + запомнить removeEventListener с ТЕМИ ЖЕ аргументами. */
    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options)
      return api.add(() => target.removeEventListener(type, handler, options))
    },
    /**
     * setTimeout, отменяемый при уборке. Баг без него: блок удалили, а через 2 с
     * таймер меняет текст удалённого элемента или шлёт событие «из прошлого».
     * @returns {() => void} отменить вручную
     */
    timeout(fn, ms) {
      if (disposed) return () => {}
      const id = setTimeout(fn, ms)
      return api.add(() => clearTimeout(id))
    },
    /** setInterval, отменяемый при уборке. @returns {() => void} остановить вручную */
    interval(fn, ms) {
      if (disposed) return () => {}
      const id = setInterval(fn, ms)
      return api.add(() => clearInterval(id))
    },
    /** Выполнить всё в обратном порядке. Повторный вызов безопасен. */
    dispose() {
      if (disposed) return
      disposed = true
      while (tasks.length) {
        try {
          tasks.pop()()
        } catch (error) {
          console.error('[kit] dispose', error)
        }
      }
    },
    get disposed() {
      return disposed
    },
  }
  return api
}

/**
 * Следить за появлением элемента на экране.
 * @param {Element} el
 * @param {{ enter?: Function, leave?: Function, rootMargin?: string, threshold?: number, once?: boolean }} o
 *   once — отключиться после первого enter (анимации появления, счётчики).
 * @returns {() => void} отключить
 */
export function onViewport(el, { enter, leave, rootMargin = '0px', threshold = 0, once = false } = {}) {
  // Нет IntersectionObserver (очень старый браузер, тесты) — считаем видимым.
  if (typeof IntersectionObserver === 'undefined') {
    enter?.()
    return () => {}
  }

  let inside = null
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1]
      if (entry.isIntersecting === inside) return // зовём только при смене состояния
      inside = entry.isIntersecting
      if (inside) {
        enter?.(entry)
        if (once) observer.disconnect()
      } else leave?.(entry)
    },
    { rootMargin, threshold },
  )
  observer.observe(el)
  return () => observer.disconnect()
}
