import { describe, expect, it } from 'vitest'
import { calcMortgage, minDown } from './mortgage'
import { EMPTY, applyFilters, fromSearch, matches, toSearch } from './filters'
import { FLATS, bounds, formatPrice, generateFlats, summary } from '../data/flats'
import { facts } from '../data/project'

describe('mortgage', () => {
  it('аннуитет: 10 млн, 20 % взнос, 6 %, 30 лет', () => {
    const r = calcMortgage({ price: 10_000_000, down: 2_000_000, rate: 6, years: 30 })
    expect(r.loan).toBe(8_000_000)
    expect(r.monthly).toBe(47_964) // эталон из банковских калькуляторов
    expect(r.overpayment).toBe(r.total - 8_000_000)
    expect(r.income).toBe(r.monthly * 2)
  })

  it('рассрочка 0 % — кредит делится поровну; взнос больше цены — кредит 0', () => {
    expect(calcMortgage({ price: 1_200_000, down: 0, rate: 0, years: 1 }).monthly).toBe(100_000)
    expect(calcMortgage({ price: 1, down: 5, rate: 6, years: 10 }).loan).toBe(0)
    expect(minDown(10_000_000, 15)).toBe(1_500_000)
  })
})

describe('квартиры', () => {
  it('генерация детерминирована и совпадает с цифрами на главной', () => {
    expect(generateFlats()).toEqual(generateFlats())
    expect(FLATS).toHaveLength(facts.find((f) => f.label === 'квартир')!.value)
    expect(new Set(FLATS.map((f) => f.id)).size).toBe(FLATS.length)
    expect(FLATS.some((f) => f.status === 'free')).toBe(true)
  })

  it('summary и bounds', () => {
    const s = summary()
    expect(s.map((x) => x.rooms)).toEqual([0, 1, 2, 3])
    expect(s.every((x) => x.count > 0 && x.priceFrom > 0)).toBe(true)
    const b = bounds()
    expect(b.price[0]).toBeLessThanOrEqual(Math.min(...FLATS.map((f) => f.price)))
    expect(formatPrice(12_345_000)).toBe('12,35 млн ₽')
  })
})

describe('фильтры', () => {
  it('комнаты, диапазоны, башня, только свободные', () => {
    const f = { ...EMPTY, rooms: [2], price: [0, 12_000_000] as [number, number], tower: 1 }
    const result = applyFilters(FLATS, f)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((x) => x.rooms === 2 && x.tower === 1 && x.status === 'free' && x.price <= 12_000_000)).toBe(
      true,
    )
    expect(result.map((x) => x.price)).toEqual([...result.map((x) => x.price)].sort((a, b) => a - b))
    expect(matches(FLATS[0], { ...EMPTY, onlyFree: false })).toBe(true)
  })

  it('адрес ↔ фильтры: туда и обратно без потерь, мусор игнорируется', () => {
    const f = {
      ...EMPTY,
      rooms: [1, 2],
      price: [5e6, 12e6] as [number, number],
      tower: 2,
      onlyFree: false,
      sort: '-area' as const,
    }
    const search = toSearch(f)
    expect(search).toBe('?rooms=1%2C2&price=5000000-12000000&tower=2&status=all&sort=-area')
    expect(fromSearch(search)).toEqual(f)
    expect(fromSearch('?rooms=9,x&tower=7&sort=hack&price=abc')).toEqual(EMPTY)
    expect(toSearch(EMPTY)).toBe('')
  })

  it('диапазон, равный полному, в адрес не пишется', () => {
    const full = { price: [1, 10] as [number, number] }
    expect(toSearch({ ...EMPTY, price: [1, 10] }, full)).toBe('')
  })

  it('чужие параметры адреса (таб view) сохраняются, старые фильтры — заменяются', () => {
    expect(toSearch({ ...EMPTY, rooms: [2] }, {}, '?rooms=1&view=chess')).toBe('?view=chess&rooms=2')
    expect(toSearch(EMPTY, {}, '?tower=3&view=chess')).toBe('?view=chess')
  })
})

describe('планировки', async () => {
  const { PLANS, planSvg, roomArea } = await import('./plan')
  it('комнаты не выходят за контур и не перекрываются', () => {
    for (const plan of Object.values(PLANS)) {
      for (const r of plan.rooms) {
        expect(r.x + r.w).toBeLessThanOrEqual(plan.width)
        expect(r.y + r.h).toBeLessThanOrEqual(plan.height)
      }
      const area = plan.rooms.reduce((s, r) => s + r.w * r.h, 0)
      expect(area).toBe(plan.width * plan.height) // комнаты заполняют план целиком, без дыр и наложений
    }
  })

  it('SVG с подписями; площади комнат в сумме = площадь квартиры', () => {
    const svg = planSvg('two', { totalArea: 60 })
    expect(svg).toContain('<svg')
    expect(svg).toContain('Кухня-гостиная')
    const sum = PLANS.two.rooms.reduce((s, r) => s + roomArea(r, 60 / ((92 * 62) / 100)), 0)
    expect(Math.round(sum)).toBe(60)
  })
})
