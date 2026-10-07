import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTooltips, tooltipContent } from './index.js'
import { html, key, tick } from '@test/helpers.js'

let api
afterEach(() => {
  api?.destroy()
  document.body.innerHTML = ''
  vi.useRealTimers()
})
const over = (el) => el.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
const out = (el) => el.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }))

describe('tooltip', () => {
  it('текст: data-tooltip, иначе aria-label; template — разметка', () => {
    expect(tooltipContent(html('<button data-tooltip="Удалить запись">x</button>'))).toBe('Удалить запись')
    expect(tooltipContent(html('<button aria-label="Закрыть" data-tooltip>x</button>'))).toBe('Закрыть')
    expect(tooltipContent(html('<button data-tooltip>x</button>'))).toBeNull()
    html('<template id="t"><b>НДС</b> включён</template>')
    const frag = tooltipContent(html('<abbr data-tooltip-template="#t">НДС</abbr>'))
    expect(frag.textContent).toBe('НДС включён')
  })

  it('наведение: показ после задержки, aria-describedby, уход — скрытие', () => {
    vi.useFakeTimers()
    api = createTooltips({ delay: 300 })
    const btn = html('<button data-tooltip="Скачать прайс">Прайс</button>')
    over(btn)
    expect(api.element.hidden).toBe(true) // ещё не прошла задержка
    vi.advanceTimersByTime(300)
    expect(api.element.hidden).toBe(false)
    expect(api.element.textContent).toBe('Скачать прайс')
    expect(api.element.getAttribute('role')).toBe('tooltip')
    expect(btn.getAttribute('aria-describedby')).toBe(api.element.id)
    out(btn)
    expect(api.element.hidden).toBe(true)
    expect(btn.hasAttribute('aria-describedby')).toBe(false)
  })

  it('подгруженный позже элемент работает без инициализации (делегирование)', () => {
    vi.useFakeTimers()
    api = createTooltips({ delay: 0 })
    const late = html('<span data-tooltip="Позже">?</span>')
    over(late)
    vi.advanceTimersByTime(0)
    expect(api.element.textContent).toBe('Позже')
  })

  it('aria-label не дублируется в aria-describedby; Esc прячет и не уходит дальше', () => {
    api = createTooltips()
    const btn = html('<button aria-label="Тёмная тема" data-tooltip></button>')
    api.show(btn)
    expect(btn.hasAttribute('aria-describedby')).toBe(false)
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    key(btn, 'Escape')
    expect(api.element.hidden).toBe(true)
    expect(outer).not.toHaveBeenCalled() // модалка под подсказкой не закрылась
    document.removeEventListener('keydown', outer)
  })

  it('destroy убирает элемент подсказки и обработчики', async () => {
    api = createTooltips({ delay: 0 })
    const el = api.element
    api.destroy()
    expect(el.isConnected).toBe(false)
    over(html('<b data-tooltip="x">x</b>'))
    await tick(5)
    expect(document.querySelector('.tooltip')).toBeNull()
    api = null
  })
})
