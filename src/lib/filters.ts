/**
 * Фильтр и сортировка квартир + синхронизация с адресной строкой.
 * Чистые функции — используются и на странице (в браузере), и в тестах.
 *
 * Адрес: /flats?rooms=1,2&price=5000000-12000000&area=30-60&floor=5-16&tower=2&status=free&sort=price
 * Ссылкой на подборку можно поделиться — фильтры восстановятся.
 */
import type { Flat } from '../data/flats'

export interface Filters {
  rooms: number[]
  price: [number, number] | null
  area: [number, number] | null
  floor: [number, number] | null
  tower: number | null
  /** Показывать только свободные. */
  onlyFree: boolean
  finish: string[]
  sort: 'price' | '-price' | 'area' | '-area' | 'floor'
}

export const EMPTY: Filters = {
  rooms: [],
  price: null,
  area: null,
  floor: null,
  tower: null,
  onlyFree: true,
  finish: [],
  sort: 'price',
}

const inRange = (value: number, range: [number, number] | null) => !range || (value >= range[0] && value <= range[1])

export function matches(flat: Flat, f: Filters) {
  return (
    (f.rooms.length === 0 || f.rooms.includes(flat.rooms)) &&
    inRange(flat.price, f.price) &&
    inRange(flat.area, f.area) &&
    inRange(flat.floor, f.floor) &&
    (f.tower === null || flat.tower === f.tower) &&
    (!f.onlyFree || flat.status === 'free') &&
    (f.finish.length === 0 || f.finish.includes(flat.finish))
  )
}

const SORTERS: Record<Filters['sort'], (a: Flat, b: Flat) => number> = {
  price: (a, b) => a.price - b.price,
  '-price': (a, b) => b.price - a.price,
  area: (a, b) => a.area - b.area,
  '-area': (a, b) => b.area - a.area,
  floor: (a, b) => a.floor - b.floor || a.position - b.position,
}

export const applyFilters = (flats: Flat[], f: Filters) =>
  flats.filter((flat) => matches(flat, f)).sort(SORTERS[f.sort])

const parseRange = (value: string | null): [number, number] | null => {
  if (!value) return null
  const [a, b] = value.split('-').map(Number)
  return Number.isFinite(a) && Number.isFinite(b) ? [Math.min(a, b), Math.max(a, b)] : null
}

/** Адрес → фильтры. Мусор в адресе не ломает страницу: берётся значение по умолчанию. */
export function fromSearch(search: string): Filters {
  const p = new URLSearchParams(search)
  const list = (key: string) => (p.get(key) ?? '').split(',').filter(Boolean)
  const sort = p.get('sort') as Filters['sort']
  return {
    rooms: list('rooms')
      .map(Number)
      .filter((n) => [0, 1, 2, 3].includes(n)),
    price: parseRange(p.get('price')),
    area: parseRange(p.get('area')),
    floor: parseRange(p.get('floor')),
    tower: [1, 2, 3].includes(Number(p.get('tower'))) ? Number(p.get('tower')) : null,
    onlyFree: p.get('status') !== 'all',
    finish: list('finish'),
    sort: sort in SORTERS ? sort : 'price',
  }
}

/** Фильтры → строка адреса (только то, что отличается от умолчаний). */
/** Параметры адреса, которыми управляют фильтры. Остальные (например, view
 *  у табов «Список / Шахматка») toSearch сохраняет как были. */
export const FILTER_KEYS = ['rooms', 'price', 'area', 'floor', 'tower', 'status', 'finish', 'sort']

/**
 * Фильтры → строка адреса. current — текущий location.search: чужие параметры
 * из него переносятся (иначе фильтр стирал бы ?view=chess и после
 * перезагрузки открывался бы не тот таб).
 */
export function toSearch(f: Filters, defaults: Partial<Filters> = {}, current = '') {
  const p = new URLSearchParams(current)
  FILTER_KEYS.forEach((key) => p.delete(key))
  const sameRange = (a: [number, number] | null, b?: [number, number] | null) =>
    !a || (b && a[0] === b[0] && a[1] === b[1])
  if (f.rooms.length) p.set('rooms', f.rooms.join(','))
  if (!sameRange(f.price, defaults.price)) p.set('price', f.price!.join('-'))
  if (!sameRange(f.area, defaults.area)) p.set('area', f.area!.join('-'))
  if (!sameRange(f.floor, defaults.floor)) p.set('floor', f.floor!.join('-'))
  if (f.tower) p.set('tower', String(f.tower))
  if (!f.onlyFree) p.set('status', 'all')
  if (f.finish.length) p.set('finish', f.finish.join(','))
  if (f.sort !== 'price') p.set('sort', f.sort)
  const s = p.toString()
  return s ? `?${s}` : ''
}
