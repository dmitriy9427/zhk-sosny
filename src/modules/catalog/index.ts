/**
 * Каталог квартир: фильтры → шахматка + список, всё синхронно с адресом.
 *
 * Разметка — pages/flats/index.astro:
 *   <section data-module="catalog">
 *     <form data-catalog-filters> … комнаты, ползунки (модуль range), башня … </form>
 *     <div data-catalog-chess> … ячейки [data-flat-cell="id"] … </div>
 *     <div data-catalog-list></div>   ← сюда рисуются карточки
 *     <button data-catalog-more>Показать ещё</button>
 *     <script type="application/json" data-catalog-data>[…все квартиры…]</script>
 *   </section>
 *
 * ─── Как работает ────────────────────────────────────────────────────────────
 * 1. При загрузке фильтры берутся из адреса (/flats/?rooms=2&tower=1) и
 *    выставляются в форму.
 * 2. Любое изменение формы → объект Filters → lib/filters.ts (чистые функции,
 *    покрыты тестами) → новый адрес (replaceState — история не засоряется).
 * 3. Шахматка: подходящие ячейки подсвечены, остальные приглушены.
 *    Список: первые 24 карточки, «Показать ещё» добавляет следующие.
 * 4. Счётчик «Найдено N квартир» — со склонением.
 */
import { createDisposer } from 'kit/js/core/lifecycle.js'
import { debounce } from 'kit/js/core/timing.js'
import { plural } from 'kit/js/form/schema.js'
import { EMPTY, applyFilters, fromSearch, toSearch, type Filters } from '../../lib/filters'
import { cardHtml } from '../../lib/card'
import type { Flat } from '../../data/flats'

const PAGE = 24

export default function catalog(root: HTMLElement) {
  const d = createDisposer()
  const form = root.querySelector<HTMLFormElement>('[data-catalog-filters]')!
  const list = root.querySelector<HTMLElement>('[data-catalog-list]')!
  const more = root.querySelector<HTMLButtonElement>('[data-catalog-more]')
  const counters = root.querySelectorAll<HTMLElement>('[data-catalog-count]')
  const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-flat-cell]'))
  const flats: Flat[] = JSON.parse(root.querySelector('[data-catalog-data]')?.textContent ?? '[]')
  const defaults = JSON.parse(form.dataset.bounds ?? '{}') as Pick<Filters, 'price' | 'area' | 'floor'>
  let shown = PAGE
  let result: Flat[] = []

  const rangeOf = (name: string): [number, number] => {
    const min = form.elements.namedItem(`${name}Min`) as HTMLInputElement
    const max = form.elements.namedItem(`${name}Max`) as HTMLInputElement
    return [Number(min.value), Number(max.value)]
  }

  /** Форма → фильтры. */
  function read(): Filters {
    const data = new FormData(form)
    return {
      rooms: data.getAll('rooms').map(Number),
      price: rangeOf('price'),
      area: rangeOf('area'),
      floor: rangeOf('floor'),
      tower: Number(data.get('tower')) || null,
      onlyFree: data.get('onlyFree') === 'on',
      finish: data.getAll('finish').map(String),
      sort: (data.get('sort') as Filters['sort']) || 'price',
    }
  }

  /** Фильтры → форма (из адреса при загрузке). */
  function write(f: Filters) {
    form
      .querySelectorAll<HTMLInputElement>('[name="rooms"]')
      .forEach((i) => (i.checked = f.rooms.includes(Number(i.value))))
    form.querySelectorAll<HTMLInputElement>('[name="finish"]').forEach((i) => (i.checked = f.finish.includes(i.value)))
    const onlyFree = form.elements.namedItem('onlyFree') as HTMLInputElement
    onlyFree.checked = f.onlyFree
    const setSelect = (name: string, value: string) => {
      const select = form.elements.namedItem(name) as HTMLSelectElement
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: false }))
    }
    setSelect('tower', f.tower ? String(f.tower) : '')
    setSelect('sort', f.sort)
    // Ползунки: меняем значения и шлём input — модуль range перерисует
    // заливку и подписи, когда бы он ни запустился (он слушает input).
    for (const name of ['price', 'area', 'floor'] as const) {
      const value = f[name] ?? defaults[name]
      if (!value) continue
      const min = form.elements.namedItem(`${name}Min`) as HTMLInputElement
      const max = form.elements.namedItem(`${name}Max`) as HTMLInputElement
      min.value = String(value[0])
      max.value = String(value[1])
      max.dispatchEvent(new Event('input'))
    }
  }

  function renderList() {
    list.innerHTML = result.slice(0, shown).map(cardHtml).join('')
    if (more) more.hidden = shown >= result.length
    document.dispatchEvent(new CustomEvent('catalog:render'))
  }

  function apply({ resetPage = true } = {}) {
    const f = read()
    result = applyFilters(flats, f)
    if (resetPage) shown = PAGE
    const ids = new Set(result.map((x) => x.id))
    cells.forEach((cell) => cell.classList.toggle('is-match', ids.has(cell.dataset.flatCell ?? '')))
    root.classList.toggle('is-filtered', true)
    const text = `${result.length} ${plural(result.length, ['квартира', 'квартиры', 'квартир'])}`
    counters.forEach((c) => (c.textContent = text))
    renderList()
    history.replaceState(
      history.state,
      '',
      `${location.pathname}${toSearch(f, defaults, location.search)}${location.hash}`,
    )
  }

  const applyDebounced = debounce(() => apply(), 120)
  d.add(applyDebounced.cancel)
  d.listen(form, 'input', applyDebounced)
  d.listen(form, 'change', applyDebounced)
  d.listen(form, 'submit', (e: Event) => e.preventDefault())
  d.listen(form, 'reset', () => setTimeout(() => apply()))
  if (more) {
    d.listen(more, 'click', () => {
      shown += PAGE
      renderList()
    })
  }

  // Модули range/select запускаются параллельно — ждём кадр, чтобы их API были готовы.
  requestAnimationFrame(() => {
    write({ ...EMPTY, ...fromSearch(location.search) })
    apply()
  })
  return { apply, destroy: d.dispose }
}
