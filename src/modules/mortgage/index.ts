/**
 * Ипотечный калькулятор.
 *
 *   <form class="mortgage" data-module="mortgage" data-mortgage-price="12000000"> … </form>
 *
 * Поля (name): price (стоимость), program (радио), down (взнос, %), years.
 * Вывод: [data-out="monthly|loan|overpayment|income|down"].
 * Расчёт — lib/mortgage.ts (покрыт тестами). Ставки программ — data/project.ts.
 * Пересчёт на каждое движение ползунка; число «набегает» плавно (GSAP).
 */
import { gsap } from 'kit/js/core/gsap.js'
import { createDisposer } from 'kit/js/core/lifecycle.js'
import { plural } from 'kit/js/form/schema.js'
import { calcMortgage, minDown } from '../../lib/mortgage'
import { mortgagePrograms } from '../../data/project'

const rub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`

export default function mortgage(form: HTMLFormElement, ctx: { reduced?: boolean } = {}) {
  const d = createDisposer()
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | RadioNodeList | null
  const out = (key: string) => form.querySelector<HTMLElement>(`[data-out="${key}"]`)
  const shown: Record<string, number> = {}

  const animate = (key: string, value: number, format: (n: number) => string) => {
    const el = out(key)
    if (!el) return
    const state = { v: shown[key] ?? value }
    shown[key] = value
    gsap.to(state, {
      v: value,
      duration: ctx.reduced ? 0 : 0.5,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => (el.textContent = format(state.v)),
    })
  }

  function update() {
    const price = Number((field('price') as HTMLInputElement).value)
    const programId = (field('program') as RadioNodeList).value
    const program = mortgagePrograms.find((p) => p.id === programId) ?? mortgagePrograms[0]
    const downInput = field('down') as HTMLInputElement
    // Взнос не меньше минимума программы.
    downInput.min = String(program.minDown)
    if (Number(downInput.value) < program.minDown) downInput.value = String(program.minDown)
    const yearsInput = field('years') as HTMLInputElement
    // Рассрочка — до ввода дома (не больше 2 лет).
    yearsInput.max = program.rate === 0 ? '2' : '30'
    if (Number(yearsInput.value) > Number(yearsInput.max)) yearsInput.value = yearsInput.max
    const downPercent = Number(downInput.value)
    const down = Math.max(minDown(price, program.minDown), Math.round((price * downPercent) / 100))
    const years = Number(yearsInput.value)
    const result = calcMortgage({ price, down, rate: program.rate, years })

    // Заливка ползунков слева от ручки (CSS: .range-input, переменная --fill).
    form.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
      const min = Number(input.min)
      const span = Number(input.max) - min || 1
      input.style.setProperty('--fill', `${((Number(input.value) - min) / span) * 100}%`)
    })
    const setText = (key: string, text: string) => {
      const el = out(key)
      if (el) el.textContent = text
    }
    setText('price', rub(price))
    setText('down', `${rub(down)} · ${downPercent} %`)
    setText('years', `${years} ${plural(years, ['год', 'года', 'лет'])}`)
    setText('rate', `${program.rate} %`)
    animate('monthly', result.monthly, rub)
    animate('loan', result.loan, rub)
    animate('overpayment', result.overpayment, rub)
    animate('income', result.income, rub)
  }

  d.listen(form, 'input', update)
  d.listen(form, 'change', update)
  d.listen(form, 'submit', (event: Event) => event.preventDefault())
  update()
  return { update, destroy: d.dispose }
}
