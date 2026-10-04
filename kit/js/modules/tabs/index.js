/**
 * Табы (вкладки) по паттерну WAI-ARIA.
 *
 *   <div class="tabs" data-module="tabs">
 *     <div class="tabs__list" data-tabs-list>
 *       <button class="tabs__tab" data-tabs-tab>Описание</button>
 *       <button class="tabs__tab" data-tabs-tab>Отзывы</button>
 *     </div>
 *     <div class="tabs__panel" data-tabs-panel>…</div>
 *     <div class="tabs__panel" data-tabs-panel>…</div>
 *   </div>
 *
 * Роли, aria-selected, aria-controls, tabindex модуль расставит сам — в
 * разметке их писать не нужно. Клавиатура: ←/→ (по кругу), Home/End.
 *
 * ─── Вкладка в адресной строке ──────────────────────────────────────────────
 * Открытая вкладка пишется в параметр адреса: /product?tab=reviews.
 * После перезагрузки или по присланной ссылке откроется та же вкладка.
 * - имя параметра: data-tabs-param, иначе id корня, иначе «tab». На странице
 *   несколько групп табов — дайте каждой своё имя (иначе предупреждение);
 * - значение: data-tabs-value у вкладки, иначе id панели, иначе номер с 1;
 * - вкладка по умолчанию в адрес не пишется (адрес чище);
 * - replaceState: клики по вкладкам не засоряют историю «Назад»;
 * - выключить: data-tabs-url="false".
 * Почему параметр, а не #хеш — kit/js/core/url.js.
 *
 * Начальная вкладка: из адреса → data-tabs-active="1" → первая.
 *
 * Частый баг, который здесь закрыт: при переключении вкладки меняется высота
 * страницы, и анимации на скролле ниже срабатывают «не там». Модуль шлёт
 * событие 'tabs:change'; createApp сам пересчитывает ScrollTrigger при
 * изменении высоты страницы (ResizeObserver).
 * @module kit/modules/tabs
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { ensureId, ownElements } from '../../core/dom.js'
import { getParam, setParam } from '../../core/url.js'

const DEFAULTS = {
  /** Номер вкладки по умолчанию (с 0). */
  active: 0,
  /** Хранить открытую вкладку в адресе (?tab=…). */
  url: true,
  /** Имя параметра в адресе. Пусто — id корня или «tab». */
  param: '',
}

/** Какие имена параметров уже заняты на странице — чтобы предупредить о конфликте. */
const usedParams = new Set()

const own = (root, selector) => ownElements(root, selector, '[data-tabs-panel]')

export default function tabs(root, ctx = {}) {
  const options = readOptions(root, 'tabs', DEFAULTS, ctx.options)
  const d = createDisposer()
  const list = own(root, '[data-tabs-list]')[0]
  const tabsEls = own(root, '[data-tabs-tab]')
  const panels = own(root, '[data-tabs-panel]')

  if (tabsEls.length !== panels.length) {
    console.warn(`[kit] tabs: вкладок ${tabsEls.length}, а панелей ${panels.length} — должны совпадать`, root)
  }

  list?.setAttribute('role', 'tablist')
  tabsEls.forEach((tab, i) => {
    const panel = panels[i]
    tab.setAttribute('role', 'tab')
    if (tab.tagName === 'BUTTON') tab.type = 'button' // внутри формы кнопка без type отправляет форму
    if (!panel) return
    tab.setAttribute('aria-controls', ensureId(panel, 'tab-panel'))
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', ensureId(tab, 'tab'))
    panel.tabIndex = 0
  })

  let current = -1
  const param = options.param || root.id || 'tab'
  const valueOf = (i) => tabsEls[i]?.dataset.tabsValue || panels[i]?.id || String(i + 1)
  const indexOf = (value) => tabsEls.findIndex((_, i) => valueOf(i) === value)
  const fallback = Math.min(Math.max(options.active, 0), tabsEls.length - 1)

  if (options.url) {
    if (usedParams.has(param)) {
      console.warn(`[kit] tabs: параметр адреса «${param}» уже занят другими табами — задайте data-tabs-param`, root)
    }
    usedParams.add(param)
    d.add(() => usedParams.delete(param))
  }

  function select(index, { focus = false, emit = true } = {}) {
    if (index < 0 || index >= tabsEls.length || index === current) return
    current = index
    tabsEls.forEach((tab, i) => {
      const active = i === index
      tab.setAttribute('aria-selected', String(active))
      tab.tabIndex = active ? 0 : -1 // «бегущий» tabindex: Tab попадает только на активную
      tab.classList.toggle('is-active', active)
      if (panels[i]) panels[i].hidden = !active
    })
    if (focus) tabsEls[index].focus()
    if (options.url && emit) setParam(param, index === fallback ? null : valueOf(index))
    if (emit) root.dispatchEvent(new CustomEvent('tabs:change', { bubbles: true, detail: { index } }))
  }

  const fromUrl = options.url ? indexOf(getParam(param)) : -1
  // Старые ссылки вида #id-панели тоже понимаем.
  const fromHash = panels.findIndex((p) => p.id && `#${p.id}` === location.hash)
  select(fromUrl >= 0 ? fromUrl : fromHash >= 0 ? fromHash : fallback, { emit: false })

  // «Назад/Вперёд» по истории (например, с другой страницы) — вкладка из адреса.
  if (options.url) {
    d.listen(window, 'popstate', () => {
      const index = indexOf(getParam(param))
      select(index >= 0 ? index : fallback, { emit: false })
    })
  }

  d.listen(root, 'click', (event) => {
    const index = tabsEls.indexOf(event.target.closest('[data-tabs-tab]'))
    if (index >= 0) select(index)
  })

  d.listen(root, 'keydown', (event) => {
    const index = tabsEls.indexOf(event.target)
    if (index < 0) return
    const n = tabsEls.length
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: n - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    select((next + n) % n, { focus: true })
  })

  return {
    select: (i) => select(i),
    get index() {
      return current
    },
    destroy: d.dispose,
  }
}
