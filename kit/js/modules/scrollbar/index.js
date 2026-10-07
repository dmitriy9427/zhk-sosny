/**
 * Красивый «плавающий» скроллбар у блока (OverlayScrollbars).
 *
 *   <div class="scroll-area" data-module="scrollbar" style="max-height: 400px">…</div>
 *   <div data-module="scrollbar" data-scrollbar-axis="x">широкая таблица</div>
 *   <div data-module="scrollbar" data-scrollbar-auto-hide="never">…</div>
 *
 * ─── Когда нужен модуль, а когда хватит CSS ────────────────────────────────
 * Страницу и обычные блоки красит CSS (kit/scss/base/_scrollbar.scss): тонкий
 * скроллбар в цветах темы, без JS. Модуль — когда по дизайну скроллбар
 * должен быть ПОВЕРХ содержимого (не отнимает ширину), прятаться, пока блок не
 * крутят, и выглядеть одинаково в Windows, macOS и Linux: списки в модалках,
 * чаты, таблицы, боковые панели.
 *
 * ─── Почему не на всю страницу (и не SimpleBar на body) ────────────────────
 * Такие библиотеки на <body> заменяют прокрутку окна прокруткой своего блока:
 * ломаются position: sticky, ScrollTrigger (считает от window), Lenis, якоря,
 * восстановление позиции «Назад». Для страницы — только CSS.
 *
 * ─── Что здесь предусмотрено ───────────────────────────────────────────────
 * - Прокрутка остаётся НАТИВНОЙ (инерция, клавиатура, поиск по странице) —
 *   библиотека только прячет системный скроллбар и рисует свой.
 * - Lenis не перехватывает колесо внутри (data-overlayscrollbars-viewport —
 *   в списке вложенных скроллеров, kit/js/core/smooth-scroll.js).
 * - Тема — CSS-переменные кита (.os-theme-kit в _scrollbar.scss), тёмная
 *   тема подхватывается сама.
 * - destroy возвращает разметку как была.
 * @module kit/modules/scrollbar
 */
import { OverlayScrollbars } from 'overlayscrollbars'
import 'overlayscrollbars/overlayscrollbars.css'
import { readOptions } from '../../core/options.js'
import { scrollbarOptions } from '../../core/scrollbars.js'

const DEFAULTS = {
  /** Направление: y — вертикально, x — горизонтально, both — оба. */
  axis: 'y',
  /** Когда прятать: leave (курсор ушёл), scroll (после прокрутки), move, never. */
  autoHide: 'leave',
  /** Задержка перед скрытием, мс. */
  autoHideDelay: 600,
  /** Класс темы (стили — kit/scss/base/_scrollbar.scss). */
  theme: 'os-theme-kit',
}

export default function scrollbar(el, ctx = {}) {
  const options = readOptions(el, 'scrollbar', DEFAULTS, ctx.options)
  const instance = OverlayScrollbars(
    el,
    scrollbarOptions({
      axis: /** @type {'x' | 'y' | 'both'} */ (options.axis),
      autoHide: options.autoHide,
      autoHideDelay: options.autoHideDelay,
      theme: options.theme,
    }),
  )
  return {
    /** Экземпляр OverlayScrollbars — полный API библиотеки. */
    instance,
    /** Элемент, который реально прокручивается: viewport.scrollTo({ top: 0 }). */
    get viewport() {
      return instance.elements().viewport
    },
    destroy: () => instance.destroy(),
  }
}
