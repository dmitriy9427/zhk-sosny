/**
 * createApp — запуск всего за один вызов. Используется в стартере vanilla:
 *
 *   const app = await createApp({ modules: { ...kitModules, ...projectModules } })
 *
 * Что делает по шагам:
 *   1. ставит на <html> класс `js` (CSS прячет элементы до анимации появления
 *      только при включённом JS — без JS контент виден, см. base/_a11y.scss);
 *   2. создаёт контекст ctx = { bus, scroll, reduced, breakpoints, modules } — его получит каждый модуль;
 *   3. включает плавный скролл (кроме тача и reduced motion);
 *   4. запускает все data-module на странице;
 *   5. следит за DOM: подгруженные блоки (htmx, «Показать ещё») запускаются сами;
 *   6. упорядочивает ScrollTrigger по странице (модули грузятся в разном порядке) и
 *      пересчитывает их, когда догрузились шрифты/картинки и
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
import { modules as modulesApi } from './modules.js'

/**
 * @param {object} [o]
 * @param {Record<string, Function>} [o.modules] Реестр модулей.
 * @param {Array<Function>} [o.plugins] Плагины приложения (src/plugins/*): запускаются ОДИН раз
 *   до модулей, получают { ctx, modules }; могут вернуть функцию уборки.
 * @param {boolean | { duration?: number, prevent?: (node: HTMLElement) => boolean }} [o.smooth=true]
 *   Плавный скролл Lenis (на таче и при reduced всё равно выключится). Объект — настройки:
 *   prevent — свои блоки со своей прокруткой (см. core/smooth-scroll.js).
 * @param {boolean} [o.watch=true] Автоматически запускать модули в подгруженном контенте.
 * @param {ParentNode} [o.root=document]
 */
export async function createApp({ modules = {}, plugins = [], smooth = true, watch = true, root = document } = {}) {
  const html = document.documentElement
  html.classList.add('js')

  const d = createDisposer()
  const reduced = prefersReducedMotion()
  const smoothOptions = typeof smooth === 'object' ? smooth : {}
  const scroll = createSmoothScroll({ ...smoothOptions, enabled: Boolean(smooth) && !reduced && !isTouch(), reduced })
  d.add(() => scroll.destroy())
  setScrollEngine(scroll)
  d.add(() => setScrollEngine(null))

  // modules — доступ к другим модулям: ctx.modules.get('#faq'), await ctx.modules.when('#cart', 'cart').
  const ctx = { bus: createBus(), scroll, reduced, breakpoints: getBreakpoints(), modules: modulesApi }
  // Плагины — до модулей: настройки GSAP, аналитика, подписки на шину должны
  // быть готовы к моменту, когда модули начнут анимировать и слать события.
  for (const plugin of plugins) {
    try {
      d.add(await plugin({ ctx, modules: modulesApi }))
    } catch (error) {
      console.error(`[kit] плагин «${plugin.name || 'без имени'}» упал при запуске`, error)
    }
  }

  const result = await mount(modules, ctx, root)
  // Модули запускаются асинхронно: ленивый модуль ВЫШЕ по странице (галерея с pin)
  // может создать свой ScrollTrigger ПОЗЖЕ модуля ниже (hscroll). ScrollTrigger
  // считает позиции в порядке создания — и нижний не учитывает место, которое
  // добавляет закрепление верхнего: анимация стартует на сотни px раньше.
  // sort() упорядочивает по положению на странице, refresh() пересчитывает.
  ScrollTrigger.sort()
  ScrollTrigger.refresh()

  if (watch) d.add(observe(modules, ctx, document.body, { strict: false }))

  // Пересчёт ScrollTrigger при изменении высоты страницы (догрузились картинки,
  // раскрылся аккордеон, подгрузился контент). debounce — чтобы не пересчитывать
  // 50 раз, пока грузится галерея.
  const refresh = debounce(() => {
    ScrollTrigger.sort()
    ScrollTrigger.refresh()
  }, 200)
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
    /** Доступ к модулям: app.modules.get('#faq'), await app.modules.when('#cart', 'cart'). */
    modules: modulesApi,
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
