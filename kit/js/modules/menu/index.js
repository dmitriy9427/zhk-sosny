/**
 * Мобильное меню (бургер).
 *
 *   <button class="burger" data-module="menu" data-menu-target="site-menu"
 *           aria-label="Открыть меню"><span class="burger__lines"></span></button>
 *   <nav id="site-menu" class="mobile-menu" data-lenis-prevent> … </nav>
 *
 * Модуль ставится на КНОПКУ; панель находится по id из data-menu-target.
 *
 * ─── Баги, которые здесь закрыты ────────────────────────────────────────────
 * 1. Открыли меню на телефоне, повернули планшет/расширили окно до десктопа —
 *    меню исчезло по CSS, а прокрутка осталась заблокированной. Модуль сам
 *    закрывает меню, когда экран становится шире closeAbove.
 * 2. Клик по якорной ссылке в меню: страница прокрутилась, а меню висит
 *    поверх. Закрываем при клике по любой ссылке внутри.
 * 3. Скрытое меню доступно с клавиатуры (Tab уходит в невидимые ссылки).
 *    Закрытое меню получает inert.
 * 4. Фокус уходит за пределы открытого меню. Удерживаем (trapFocus) и
 *    возвращаем на кнопку после закрытия.
 * @module kit/modules/menu
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { trapFocus } from '../../core/dom.js'
import { upQuery, watchMedia } from '../../core/env.js'
import { lockScroll, unlockScroll } from '../../core/scroll-lock.js'
import { t } from '../../core/i18n.js'

const DEFAULTS = {
  /** id панели меню. */
  target: '',
  /** Брейкпоинт, с которого меню не нужно (закрыть и снять inert). '' — никогда. */
  closeAbove: 'lg',
  /** Подписи кнопки для скринридеров. */
  labelOpen: '',
  labelClose: '',
}

export default function menu(button, ctx = {}) {
  const options = readOptions(button, 'menu', DEFAULTS, ctx.options)
  const panel = document.getElementById(options.target)
  if (!panel) throw new Error(`[kit] menu: нет панели с id «${options.target}» (data-menu-target)`)

  const d = createDisposer()
  let isOpen = false
  let releaseFocus = null
  let desktop = false

  button.setAttribute('aria-controls', panel.id)
  button.setAttribute('aria-expanded', 'false')
  const label = (open) => (open ? options.labelClose || t('kit.menu.close') : options.labelOpen || t('kit.menu.open'))
  button.setAttribute('aria-label', label(false))

  function set(open) {
    if (open === isOpen) return
    isOpen = open
    button.setAttribute('aria-expanded', String(open))
    button.setAttribute('aria-label', label(open))
    panel.classList.toggle('is-open', open)
    document.documentElement.classList.toggle('is-menu-open', open)
    panel.inert = !open && !desktop
    if (open) {
      lockScroll()
      // Удерживаем фокус в ближайшем общем предке кнопки и панели: кнопка
      // закрытия — та же кнопка, она должна оставаться доступной с Tab.
      let scope = panel
      while (scope && !scope.contains(button)) scope = scope.parentElement
      releaseFocus = trapFocus(scope ?? panel)
    } else {
      unlockScroll()
      releaseFocus?.()
      releaseFocus = null
    }
    ctx.bus?.emit('menu:toggle', open)
    button.dispatchEvent(new CustomEvent('menu:toggle', { bubbles: true, detail: { open } }))
  }

  d.listen(button, 'click', () => set(!isOpen))

  d.listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && isOpen) {
      set(false)
      button.focus()
    }
  })

  d.listen(panel, 'click', (event) => {
    if (event.target.closest('a[href]')) set(false)
  })

  if (options.closeAbove) {
    d.add(
      watchMedia(upQuery(options.closeAbove), (matches) => {
        desktop = matches
        if (matches) set(false)
        panel.inert = !isOpen && !desktop
      }),
    )
  } else {
    panel.inert = true
  }

  d.add(() => set(false))

  return {
    open: () => set(true),
    close: () => set(false),
    toggle: () => set(!isOpen),
    get isOpen() {
      return isOpen
    },
    destroy: d.dispose,
  }
}
