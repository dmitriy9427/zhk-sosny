/**
 * Реестр модулей кита: имя в data-module → код.
 *
 *   import { kitModules } from 'kit/js/modules'
 *   createApp({ modules: { ...kitModules, ...projectModules } })
 *
 * ─── Обычные и ленивые ──────────────────────────────────────────────────────
 * Модули, от которых зависит первый экран (появление, шапка, меню, тема),
 * подключены напрямую — они в основном бандле и запускаются без задержки.
 * Остальные — через lazy(): их код скачивается, только если на странице
 * есть такой блок. Страница без слайдера не грузит код слайдера.
 *
 * Свой модуль проекта добавляйте НЕ сюда, а в src/modules/index.js проекта —
 * тогда кит можно обновлять, не теряя правок.
 * @module kit/modules
 */
import { lazy } from '../core/registry.js'
import reveal from './reveal/index.js'
import menu from './menu/index.js'
import stickyHeader from './sticky-header/index.js'
import themeSwitch from './theme-switch/index.js'

export const kitModules = {
  reveal,
  menu,
  'sticky-header': stickyHeader,
  'theme-switch': themeSwitch,
  accordion: lazy(() => import('./accordion/index.js')),
  tabs: lazy(() => import('./tabs/index.js')),
  dialog: lazy(() => import('./dialog/index.js')),
  slider: lazy(() => import('./slider/index.js')),
  swiper: lazy(() => import('./swiper/index.js')),
  marquee: lazy(() => import('./marquee/index.js')),
  'split-text': lazy(() => import('./split-text/index.js')),
  counter: lazy(() => import('./counter/index.js')),
  parallax: lazy(() => import('./parallax/index.js')),
  magnetic: lazy(() => import('./magnetic/index.js')),
  'scroll-top': lazy(() => import('./scroll-top/index.js')),
  'lazy-video': lazy(() => import('./lazy-video/index.js')),
  form: lazy(() => import('./form/index.js')),
  select: lazy(() => import('./select/index.js')),
  mask: lazy(() => import('./mask/index.js')),
  'file-upload': lazy(() => import('./file-upload/index.js')),
  password: lazy(() => import('./password/index.js')),
  autosize: lazy(() => import('./autosize/index.js')),
  'char-counter': lazy(() => import('./char-counter/index.js')),
  stepper: lazy(() => import('./stepper/index.js')),
  range: lazy(() => import('./range/index.js')),
  toast: lazy(() => import('./toast/index.js')),
  'lang-switch': lazy(() => import('./lang-switch/index.js')),
  // Эффекты (GSAP, WebGL)
  'infinite-slider': lazy(() => import('./infinite-slider/index.js')),
  'infinite-gallery': lazy(() => import('./infinite-gallery/index.js')),
  lightbox: lazy(() => import('./lightbox/index.js')),
  hscroll: lazy(() => import('./hscroll/index.js')),
  'flip-filter': lazy(() => import('./flip-filter/index.js')),
  'stack-cards': lazy(() => import('./stack-cards/index.js')),
  'scramble-text': lazy(() => import('./scramble-text/index.js')),
  'draw-svg': lazy(() => import('./draw-svg/index.js')),
  'scroll-progress': lazy(() => import('./scroll-progress/index.js')),
  cursor: lazy(() => import('./cursor/index.js')),
}
