import { describe, expect, it, vi } from 'vitest'
import select, { filterOptions, highlight, normalize, readOptionsList } from './index.js'
import form from '../form/index.js'
import { setLocale, resetLocale } from '../../core/i18n.js'
import { html, key, tick } from '@test/helpers.js'

const CITIES = `
  <option value="">Выберите город</option>
  <optgroup label="Центр"><option value="msk">Москва</option><option value="tula">Тула</option></optgroup>
  <optgroup label="Урал"><option value="ekb">Екатеринбург</option><option value="chel" disabled>Челябинск</option></optgroup>
  <option value="orel">Орёл</option>`

const setup = (attrs = '', options) => {
  const label = html(
    `<label class="field"><span class="field__label">Город</span><select name="city" ${attrs}>${CITIES}</select></label>`,
  )
  const native = label.querySelector('select')
  const api = select(native, options ? { options } : {})
  const root = label.querySelector('.select')
  return { label, native, api, root, input: root.querySelector('.select__input') }
}
const optionsShown = (root) => [...root.querySelectorAll('[role=option]')].map((o) => o.textContent)

describe('select: чистые функции', () => {
  it('normalize, filterOptions (ё = е), highlight', () => {
    expect(normalize(' Ёлка ')).toBe('елка')
    const list = [{ label: 'Орёл' }, { label: 'Москва' }]
    expect(filterOptions(list, 'орел')).toEqual([{ label: 'Орёл' }])
    expect(highlight('Москва', 'ск')).toEqual(['Мо', 'ск', 'ва'])
    expect(highlight('Москва', 'zz')).toEqual(['Москва'])
  })

  it('readOptionsList пропускает пустую подсказку, читает группы и disabled', () => {
    const native = html(`<select>${CITIES}</select>`)
    const list = readOptionsList(native)
    expect(list).toHaveLength(5)
    expect(list[0]).toEqual({ value: 'msk', label: 'Москва', disabled: false, group: 'Центр' })
    expect(list[3].disabled).toBe(true)
  })
})

describe('select: одиночный', () => {
  it('оболочка, подпись, подсказка из пустого option; настоящий select скрыт, но в форме', () => {
    const { native, root, input } = setup()
    expect(native.classList.contains('select__native')).toBe(true)
    expect(native.tabIndex).toBe(-1)
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-label')).toBe('Город')
    expect(input.placeholder).toBe('Выберите город')
    expect(input.readOnly).toBe(true)
    expect(root.querySelector('[role=listbox]')).toBeTruthy()
  })

  it('мышь: открыть, группы, выбрать — значение в настоящем select, change, закрыто', () => {
    const { native, root, input } = setup()
    const change = vi.fn()
    native.addEventListener('change', change)
    root.querySelector('.select__control').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(root.classList.contains('is-open')).toBe(true)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect([...root.querySelectorAll('.select__group')].map((g) => g.textContent)).toEqual(['Центр', 'Урал'])
    root.querySelectorAll('[role=option]')[1].click()
    expect(native.value).toBe('tula')
    expect(change).toHaveBeenCalled()
    expect(root.classList.contains('is-open')).toBe(false)
    expect(root.querySelector('.select__value').textContent).toBe('Тула')
  })

  it('клавиатура: ↓ открывает, disabled пропускается, Enter выбирает, Esc закрывает', () => {
    const { native, root, input } = setup()
    key(input, 'ArrowDown')
    expect(root.classList.contains('is-open')).toBe(true)
    key(input, 'ArrowDown') // Тула
    key(input, 'ArrowDown') // Екатеринбург
    key(input, 'ArrowDown') // Челябинск disabled → Орёл
    expect(input.getAttribute('aria-activedescendant')).toBe(root.querySelector('.is-active').id)
    expect(root.querySelector('.is-active').textContent).toBe('Орёл')
    key(input, 'Enter')
    expect(native.value).toBe('orel')
    key(input, 'ArrowDown')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(esc)
    expect(root.classList.contains('is-open')).toBe(false)
  })

  it('без поиска: печать букв переходит к варианту', () => {
    const { root, input } = setup()
    key(input, 'е')
    expect(root.querySelector('.is-active').textContent).toBe('Екатеринбург')
  })

  it('поиск: фильтр, подсветка, «ничего не найдено», aria-live', () => {
    const { root, input } = setup('data-select-search')
    expect(input.readOnly).toBe(false)
    input.value = 'орел'
    input.dispatchEvent(new Event('input'))
    expect(optionsShown(root)).toEqual(['Орёл'])
    expect(root.querySelector('mark').textContent).toBe('Орёл')
    expect(root.querySelector('[aria-live]').textContent).toBe('1 вариант')
    input.value = 'zzz'
    input.dispatchEvent(new Event('input'))
    expect(root.querySelector('.select__empty').hidden).toBe(false)
    expect(root.querySelector('.select__empty').textContent).toBe('Ничего не найдено')
  })

  it('reset формы и setValue из кода обновляют оболочку', async () => {
    const f = html(`<form><select name="c">${CITIES}</select></form>`)
    const native = f.querySelector('select')
    const api = select(native)
    api.setValue('msk')
    expect(f.querySelector('.select__value').textContent).toBe('Москва')
    native.value = '' // как после reset() формы (jsdom reset для select не делает)
    native.dispatchEvent(new Event('change'))
    expect(f.querySelector('.select__value').textContent).toBe('')
    expect(api.value).toBe('')
  })

  it('destroy возвращает обычный select', () => {
    const { native, api, label } = setup()
    api.destroy()
    expect(label.querySelector('.select')).toBeNull()
    expect(native.classList.contains('select__native')).toBe(false)
    expect(() => select(html('<div></div>'))).toThrow(/<select>/)
  })
})

describe('select: несколько значений', () => {
  it('чипсы, не закрывается, max, удаление чипса и Backspace', () => {
    const { native, root, input } = setup('multiple data-select-max="2"')
    root.querySelector('.select__control').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    const opts = () => root.querySelectorAll('[role=option]')
    expect(root.querySelector('[role=listbox]').getAttribute('aria-multiselectable')).toBe('true')
    opts()[0].click()
    opts()[1].click()
    expect(root.classList.contains('is-open')).toBe(true)
    expect([...native.selectedOptions].map((o) => o.value)).toEqual(['msk', 'tula'])
    expect([...root.querySelectorAll('.select__chip span')].map((c) => c.textContent)).toEqual(['Москва', 'Тула'])
    // Лимит: остальные варианты недоступны.
    expect(opts()[2].getAttribute('aria-disabled')).toBe('true')
    opts()[2].click()
    expect(native.selectedOptions).toHaveLength(2)
    root.querySelector('.select__chip-remove').click()
    expect([...native.selectedOptions].map((o) => o.value)).toEqual(['tula'])
    key(input, 'Backspace')
    expect(native.selectedOptions).toHaveLength(0)
  })

  it('поиск в мультивыборе очищается после выбора', () => {
    const { root, input } = setup('multiple data-select-search')
    input.value = 'тул'
    input.dispatchEvent(new Event('input'))
    root.querySelector('[role=option]').click()
    expect(input.value).toBe('')
    expect(optionsShown(root)).toHaveLength(5)
  })
})

describe('select: форма, загрузка, языки', () => {
  it('ошибка формы переносится на видимое поле; уход с поля запускает проверку', async () => {
    const f = html(
      `<form><label class="field"><span class="field__label">Город</span><select name="city" required>${CITIES}</select></label></form>`,
    )
    const native = f.querySelector('select')
    const api = form(f)
    select(native)
    const input = f.querySelector('.select__input')
    input.dispatchEvent(new FocusEvent('blur'))
    await tick()
    expect(api.errors.city).toBe('Выберите вариант')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(f.querySelector('.select').classList.contains('is-invalid')).toBe(true)
  })

  it('load: варианты с сервера по запросу, выбранное сохраняется', async () => {
    vi.useFakeTimers()
    const load = vi.fn(async (q) => [{ value: 'spb', label: `Санкт-Петербург ${q}` }])
    const { native, root, input } = setup('data-select-search', { load })
    input.value = 'сан'
    input.dispatchEvent(new Event('input'))
    await vi.advanceTimersByTimeAsync(300)
    expect(load).toHaveBeenCalledWith('сан')
    expect([...native.options].map((o) => o.value)).toContain('spb')
    expect(optionsShown(root)).toEqual(['Санкт-Петербург сан'])
    vi.useRealTimers()
  })

  it('тексты на языке страницы', () => {
    setLocale('en')
    const native = html('<select multiple><option value="a">A</option></select>')
    select(native)
    expect(document.querySelector('.select__input').placeholder).toBe('Choose…')
    resetLocale()
  })
})
