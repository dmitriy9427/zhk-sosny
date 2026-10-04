/**
 * createApp — запуск всего за один вызов. Используется в стартере vanilla:
 *
 *   const app = await createApp({ modules: { ...kitModules, ...projectModules } })
 *
 * Что делает по шагам:
 *   1. ставит на <html> класс `js` (CSS прячет элементы до анимации появления
 *      только при включённом JS — без JS контент виден, см. base/_a11y.scss);
 *   2. создаёт контекст ctx = { bus, scroll, reduced, breakpoints } — его получит каждый модуль;
 *   3. включает плавный скролл (кроме тача и reduced motion);
 *   4. запускает все data-module на странице;
 *   5. следит за DOM: подгруженные блоки (htmx, «Показать ещё») запускаются сами;
 *   6. пересчитывает ScrollTrigger, когда догрузились шрифты/картинки и
 *      поменялась высота страницы — главный источник «анимация срабатывает не там»;
 *   7. ставит класс `is-ready` и шлёт событие 'app:ready'.
 * @module kit/core/app
 */
import { ScrollTrigger } from './gsap.js'
import { createBus } from './bus.js'
import { getBreakpoints, isTouch, prefersReducedMotion } from './env.js'
import { mount, observe, unmount } from './registry.js'
import { setScrollEngine } from './scroll-lock.js'
import { createSmoothScroll } from './smooth-scroll.js'
import { debounce } from './timing.js'
import { createDisposer } from './lifecycle.js'

/**
 * @param {object} [o]
 * @param {Record<string, Function>} [o.modules] Реестр модулей.
 * @param {boolean} [o.smooth=true] Плавный скролл Lenis (на таче и при reduced всё равно выключится).
 * @param {boolean} [o.watch=true] Автоматически запускать модули в подгруженном контенте.
 * @param {ParentNode} [o.root=document]
 */
export async function createApp({ modules = {}, smooth = true, watch = true, root = document } = {}) {
  const html = document.documentElement
  html.classList.add('js')

  const d = createDisposer()
  const reduced = prefersReducedMotion()
  const scroll = createSmoothScroll({ enabled: smooth && !reduced && !isTouch(), reduced })
  d.add(() => scroll.destroy())
  setScrollEngine(scroll)
  d.add(() => setScrollEngine(null))

  const ctx = { bus: createBus(), scroll, reduced, breakpoints: getBreakpoints() }
  const result = await mount(modules, ctx, root)

  if (watch) d.add(observe(modules, ctx, document.body, { strict: false }))

  // Пересчёт ScrollTrigger при изменении высоты страницы (догрузились картинки,
  // раскрылся аккордеон, подгрузился контент). debounce — чтобы не пересчитывать
  // 50 раз, пока грузится галерея.
  const refresh = debounce(() => ScrollTrigger.refresh(), 200)
  d.add(refresh.cancel)
  if (typeof ResizeObserver !== 'undefined') {
    let lastHeight = document.body.scrollHeight
    const ro = new ResizeObserver(() => {
      const height = document.body.scrollHeight
      if (height !== lastHeight) {
        lastHeight = height
        refresh()
      }
    })
    ro.observe(document.body)
    d.add(() => ro.disconnect())
  }
  document.fonts?.ready.then(() => !d.disposed && refresh())

  html.classList.add('is-ready')
  ctx.bus.emit('app:ready', result)

  const app = {
    ctx,
    ...result,
    /** Запустить модули в новом фрагменте вручную (если watch: false). */
    mount: (node) => mount(modules, ctx, node),
    /** Остановить модули во фрагменте перед его удалением. */
    unmount,
    destroy() {
      unmount(root)
      d.dispose()
      ctx.bus.clear()
      html.classList.remove('is-ready')
    },
  }

  // В разработке приложение доступно из консоли: __kit.ctx.bus.emit(...)
  if (import.meta.env?.DEV) window.__kit = app
  return app
}
