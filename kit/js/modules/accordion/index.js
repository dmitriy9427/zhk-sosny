/**
 * Аккордеон: раскрывающиеся блоки (FAQ, характеристики, фильтры).
 *
 * Разметка (подробно — README.md рядом):
 *   <div class="accordion" data-module="accordion">
 *     <div class="accordion__item" data-accordion-item data-open>
 *       <h3><button class="accordion__trigger" data-accordion-trigger>Вопрос</button></h3>
 *       <div class="accordion__panel" data-accordion-panel>
 *         <div class="accordion__inner">Ответ</div>
 *       </div>
 *     </div>
 *   </div>
 *
 * ─── Почему анимация на CSS grid, а не на height в JS ───────────────────────
 * Анимировать height: auto нельзя, и обычно высоту меряют JS-ом. Это ломается,
 * когда внутри догружаются картинки или меняется ширина экрана — высота
 * «застывает». Трюк `grid-template-rows: 0fr → 1fr` анимирует настоящую
 * высоту содержимого силами CSS, без замеров. Стили — scss/components/_accordion.scss.
 *
 * ─── Доступность ─────────────────────────────────────────────────────────────
 * aria-expanded/aria-controls на кнопке, role="region" на панели, закрытая
 * панель получает `inert` — Tab не попадает в скрытые ссылки. Стрелки ↑/↓,
 * Home/End переключают фокус между заголовками.
 * @module kit/modules/accordion
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { ensureId, ownElements } from '../../core/dom.js'

const DEFAULTS = {
  /** Можно открыть несколько пунктов одновременно. */
  multiple: false,
  /** Открывать пункт, если его id совпадает с #хешем в адресе. */
  hash: true,
}

export default function accordion(root, ctx = {}) {
  const options = readOptions(root, 'accordion', DEFAULTS, ctx.options)
  const d = createDisposer()
  // Только «свои» пункты: вложенный аккордеон обслуживает свой модуль.
  const items = ownElements(root, '[data-accordion-item]', '[data-accordion-panel]')

  const parts = items.map((item) => {
    const trigger = ownElements(item, '[data-accordion-trigger]', '[data-accordion-panel]')[0]
    const panel = ownElements(item, '[data-accordion-panel]', '[data-accordion-panel]')[0]
    if (!trigger || !panel)
      throw new Error('[kit] accordion: в пункте нужны [data-accordion-trigger] и [data-accordion-panel]')
    trigger.setAttribute('aria-controls', ensureId(panel, 'acc-panel'))
    panel.setAttribute('role', 'region')
    panel.setAttribute('aria-labelledby', ensureId(trigger, 'acc-trigger'))
    return { item, trigger, panel }
  })

  function set(index, open, { emit = true } = {}) {
    const part = parts[index]
    if (!part) return
    const { item, trigger, panel } = part
    if (open && !options.multiple) parts.forEach((_, i) => i !== index && set(i, false, { emit }))
    const was = item.hasAttribute('data-open')
    item.toggleAttribute('data-open', open)
    trigger.setAttribute('aria-expanded', String(open))
    panel.inert = !open
    if (emit && was !== open) {
      root.dispatchEvent(new CustomEvent('accordion:toggle', { bubbles: true, detail: { index, open, item } }))
    }
  }

  // Начальное состояние — из разметки (data-open), без событий.
  parts.forEach(({ item }, i) => set(i, item.hasAttribute('data-open'), { emit: false }))
  if (!options.multiple) {
    // В режиме «один открыт» оставляем только первый открытый из разметки.
    const firstOpen = parts.findIndex(({ item }) => item.hasAttribute('data-open'))
    if (firstOpen >= 0) set(firstOpen, true, { emit: false })
  }

  if (options.hash && location.hash) {
    const target = parts.findIndex(({ item }) => `#${item.id}` === location.hash)
    if (target >= 0) set(target, true, { emit: false })
  }

  d.listen(root, 'click', (event) => {
    const trigger = event.target.closest('[data-accordion-trigger]')
    const index = parts.findIndex((p) => p.trigger === trigger)
    if (index >= 0) set(index, !parts[index].item.hasAttribute('data-open'))
  })

  d.listen(root, 'keydown', (event) => {
    const index = parts.findIndex((p) => p.trigger === event.target)
    if (index < 0) return
    const last = parts.length - 1
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: last }[event.key]
    if (next === undefined) return
    event.preventDefault()
    parts[(next + parts.length) % parts.length].trigger.focus()
  })

  return {
    open: (i) => set(i, true),
    close: (i) => set(i, false),
    toggle: (i) => set(i, !parts[i]?.item.hasAttribute('data-open')),
    isOpen: (i) => Boolean(parts[i]?.item.hasAttribute('data-open')),
    destroy: d.dispose,
  }
}
