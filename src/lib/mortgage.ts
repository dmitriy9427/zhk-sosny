/**
 * Ипотечный калькулятор: аннуитетный платёж (одинаковый каждый месяц).
 *
 *   платёж = кредит × (r × (1 + r)^n) / ((1 + r)^n − 1),
 *   где r — ставка в месяц (годовая / 12 / 100), n — число месяцев.
 * При ставке 0 (рассрочка) — просто кредит / n.
 */

export interface MortgageInput {
  price: number
  /** Первоначальный взнос, ₽. */
  down: number
  /** Ставка, % годовых. */
  rate: number
  /** Срок, лет. */
  years: number
}

export interface MortgageResult {
  loan: number
  monthly: number
  overpayment: number
  total: number
  /** Рекомендуемый доход: платёж не больше 50 % дохода. */
  income: number
}

export function calcMortgage({ price, down, rate, years }: MortgageInput): MortgageResult {
  const loan = Math.max(0, price - down)
  const n = Math.max(1, Math.round(years * 12))
  const r = rate / 12 / 100
  const monthly = r === 0 ? loan / n : (loan * (r * (1 + r) ** n)) / ((1 + r) ** n - 1)
  const total = monthly * n
  return {
    loan,
    monthly: Math.round(monthly),
    total: Math.round(total),
    overpayment: Math.round(total - loan),
    income: Math.round(monthly * 2),
  }
}

/** Минимальный взнос в рублях по проценту программы. */
export const minDown = (price: number, percent: number) => Math.ceil((price * percent) / 100 / 10_000) * 10_000
