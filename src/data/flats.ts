/**
 * Квартиры ЖК. В реальном проекте они приходят из CRM застройщика (API или
 * выгрузка в JSON). Здесь генерируются детерминированно — каждый раз одни и
 * те же: генератор случайных чисел с «зерном» (seed).
 *
 * Хотите свои данные — замените FLATS на массив из JSON с теми же полями.
 */

export type Status = 'free' | 'booked' | 'sold'
export type Layout = 'studio' | 'one' | 'two' | 'three'
export type Finish = 'none' | 'white-box' | 'design'

export interface Flat {
  id: string
  /** Номер квартиры на табличке. */
  number: number
  tower: number
  floor: number
  /** Позиция на этаже, 1…FLATS_PER_FLOOR (слева направо). */
  position: number
  rooms: 0 | 1 | 2 | 3
  layout: Layout
  area: number
  kitchen: number
  price: number
  pricePerMeter: number
  status: Status
  finish: Finish
  /** Окна во двор / на лес / на реку. */
  view: 'yard' | 'forest' | 'river'
  /** Есть терраса (последние этажи). */
  terrace: boolean
}

export const TOWERS = 3
export const FLOORS = 16
export const FLATS_PER_FLOOR = 6

/** Генератор случайных чисел с зерном (mulberry32): одинаковое зерно — одинаковая последовательность. */
export function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Типовой этаж: что стоит на каждой позиции (слева направо). */
const FLOOR_PLAN: { layout: Layout; rooms: 0 | 1 | 2 | 3; area: [number, number]; kitchen: number }[] = [
  { layout: 'three', rooms: 3, area: [78, 86], kitchen: 14 },
  { layout: 'one', rooms: 1, area: [36, 41], kitchen: 10 },
  { layout: 'studio', rooms: 0, area: [24, 29], kitchen: 0 },
  { layout: 'studio', rooms: 0, area: [25, 30], kitchen: 0 },
  { layout: 'two', rooms: 2, area: [54, 62], kitchen: 12 },
  { layout: 'two', rooms: 2, area: [58, 66], kitchen: 13 },
]

/** Базовая цена за м² по башне (у реки дороже). */
const BASE_PRICE = [210_000, 235_000, 262_000]

export function generateFlats(seed = 2027): Flat[] {
  const rnd = seeded(seed)
  const flats: Flat[] = []
  let number = 1
  for (let tower = 1; tower <= TOWERS; tower++) {
    for (let floor = 2; floor <= FLOORS; floor++) {
      FLOOR_PLAN.forEach((type, i) => {
        const position = i + 1
        const area = Math.round((type.area[0] + rnd() * (type.area[1] - type.area[0])) * 10) / 10
        // Выше этаж — дороже (+0.8 % за этаж), видовые — ещё +6 %.
        const view = position <= 2 ? 'forest' : tower === 3 && position >= 5 ? 'river' : 'yard'
        const viewBonus = view === 'yard' ? 1 : 1.06
        const pricePerMeter = Math.round((BASE_PRICE[tower - 1] * (1 + (floor - 2) * 0.008) * viewBonus) / 100) * 100
        const roll = rnd()
        // Нижние этажи раскуплены сильнее — реалистичная «шахматка».
        const soldChance = 0.55 - floor * 0.025
        const status: Status = roll < soldChance ? 'sold' : roll < soldChance + 0.12 ? 'booked' : 'free'
        const finishRoll = rnd()
        flats.push({
          id: `${tower}-${floor}-${position}`,
          number: number++,
          tower,
          floor,
          position,
          rooms: type.rooms,
          layout: type.layout,
          area,
          kitchen: type.kitchen,
          price: Math.round((area * pricePerMeter) / 10_000) * 10_000,
          pricePerMeter,
          status,
          finish: finishRoll < 0.4 ? 'none' : finishRoll < 0.8 ? 'white-box' : 'design',
          view,
          terrace: floor === FLOORS && (type.rooms >= 2 || type.rooms === 0),
        })
      })
    }
  }
  return flats
}

export const FLATS = generateFlats()

export const getFlat = (id: string) => FLATS.find((f) => f.id === id)

/** Подписи для интерфейса. */
export const ROOM_LABEL: Record<number, string> = { 0: 'Студия', 1: '1-комнатная', 2: '2-комнатная', 3: '3-комнатная' }
export const ROOM_SHORT: Record<number, string> = { 0: 'Ст', 1: '1', 2: '2', 3: '3' }
export const STATUS_LABEL: Record<Status, string> = { free: 'Свободна', booked: 'Бронь', sold: 'Продана' }
export const FINISH_LABEL: Record<Finish, string> = {
  none: 'Без отделки',
  'white-box': 'White box',
  design: 'Дизайнерская',
}
export const VIEW_LABEL: Record<Flat['view'], string> = { yard: 'Во двор', forest: 'На лес', river: 'На реку' }

/** Сводка по типам (для главной): от скольки ₽ и сколько свободно. */
export function summary(flats: Flat[] = FLATS) {
  return ([0, 1, 2, 3] as const).map((rooms) => {
    const free = flats.filter((f) => f.rooms === rooms && f.status === 'free')
    return {
      rooms,
      count: free.length,
      priceFrom: free.length ? Math.min(...free.map((f) => f.price)) : 0,
      areaFrom: free.length ? Math.min(...free.map((f) => f.area)) : 0,
    }
  })
}

/** Границы для фильтров. */
export function bounds(flats: Flat[] = FLATS) {
  const prices = flats.map((f) => f.price)
  const areas = flats.map((f) => f.area)
  return {
    price: [Math.floor(Math.min(...prices) / 100_000) * 100_000, Math.ceil(Math.max(...prices) / 100_000) * 100_000],
    area: [Math.floor(Math.min(...areas)), Math.ceil(Math.max(...areas))],
    floor: [2, FLOORS],
  }
}

export const formatPrice = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽`
    : `${n.toLocaleString('ru-RU')} ₽`
