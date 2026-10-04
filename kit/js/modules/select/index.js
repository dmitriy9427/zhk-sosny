/**
 * Кастомный селект: поиск, выбор нескольких значений, «чипсы», группы,
 * клавиатура, подгрузка вариантов с сервера, переводы.
 *
 *   <label class="field">
 *     <span class="field__label">Город</span>
 *     <select class="field__input" name="city" data-module="select" data-select-search>
 *       <option value="">Выберите город</option>       ← пустой option = подсказка (placeholder)
 *       <optgroup label="Центр">
 *         <option value="msk">Москва</option> …
 *       </optgroup>
 *     </select>
 *   </label>
 *
 *   <select name="skills" multiple data-module="select" data-select-search data-select-max="3">…</select>
 *
 * ─── Почему поверх настоящего <select> ─────────────────────────────────────
 * Настоящий <select> остаётся в форме (визуально скрыт): его значение уходит
 * при отправке, его проверяет модуль form и схема, formValues() читает его,
 * reset() формы его сбрасывает, без JS работает обычный список. Модуль только
 * рисует красивую оболочку и синхронизирует выбор в обе стороны.
 *
 * ─── Доступность (WAI-ARIA combobox + listbox) ─────────────────────────────
 * Поле ввода — role="combobox" (только для чтения, если поиска нет),
 * список — role="listbox", варианты — role="option" с aria-selected.
 * Подсвеченный вариант — aria-activedescendant: фокус остаётся в поле, а
 * скринридер читает вариант. Количество найденного — в aria-live.
 * Клавиши: ↓/↑ — открыть и двигаться, Enter — выбрать, Esc — закрыть,
 * Home/End, Backspace в пустом поле — убрать последний чипс,
 * буквы без поиска — перейти к варианту на эту букву.
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Список обрезается модалкой/карточкой с overflow: hidden или прячется под
 *    соседним блоком (z-index). Список открывается в «верхнем слое» браузера
 *    (Popover API) и позиционируется по экрану — его ничто не обрежет.
 * 2. Список у нижнего края экрана уходит за экран — открывается вверх.
 * 3. Поиск «ёлка» не находит «елка» — ё и е считаются одной буквой, регистр не важен.
 * 4. После reset() формы оболочка показывает старое значение — слушаем change
 *    настоящего select.
 * 5. Модуль form ставит aria-invalid и фокус на настоящий select — переносим
 *    их на видимое поле.
 * 6. Клик по чипсу «×» открывал/закрывал список — клики по чипсам не
 *    доходят до поля.
 * 7. Форма в режиме onTouched не проверяла селект при уходе — уход с
 *    видимого поля пересылается настоящему select.
 * @module kit/modules/select
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { uid } from '../../core/dom.js'
import { debounce } from '../../core/timing.js'
import { onLocaleChange, t } from '../../core/i18n.js'

const DEFAULTS = {
  /** Поле поиска по вариантам. */
  search: false,
  /** Подсказка, если ничего не выбрано. Пусто — текст пустого <option> или «Выберите…». */
  placeholder: '',
  /** Максимум выбранных (для multiple). 0 — без ограничения. */
  max: 0,
  /** Кнопка «очистить». */
  clearable: false,
  /** Закрывать после выбора. По умолчанию: да для одиночного, нет для multiple. */
  closeOnSelect: true,
}

/** Для поиска: регистр и ё/е не важны. */
export const normalize = (text) => String(text).toLowerCase().replace(/ё/g, 'е').trim()

/** Варианты из <select>: [{ value, label, disabled, group }]. Пустой option-подсказку пропускаем. */
export function readOptionsList(select) {
  return Array.from(select.options)
    .filter((o) => !(o.value === '' && o.index === 0)) // пустой первый option — подсказка, не вариант
    .map((o) => ({
      value: o.value,
      label: o.label || o.textContent.trim(),
      disabled: o.disabled,
      group: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '',
    }))
}

/** Отфильтровать варианты по запросу. */
export const filterOptions = (list, query) => {
  const q = normalize(query)
  return q ? list.filter((o) => normalize(o.label).includes(q)) : list
}

/** Разбить подпись на части для подсветки совпадения: ['Мо', 'ск', 'ва'] → <mark>ск</mark>. */
export function highlight(label, query) {
  const q = normalize(query)
  const index = q ? normalize(label).indexOf(q) : -1
  if (index < 0) return [label]
  return [label.slice(0, index), label.slice(index, index + q.length), label.slice(index + q.length)]
}

const canPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype

/**
 * @param {HTMLSelectElement} native
 * @param {Record<string, any>} [ctx]
 */
export default function select(native, ctx = {}) {
  if (native.tagName !== 'SELECT') throw new Error('[kit] select: модуль ставится на <select>')
  const options = readOptions(native, 'select', DEFAULTS, ctx.options)
  const multiple = native.multiple
  const closeOnSelect =
    native.hasAttribute('data-select-close-on-select') || ctx.options?.closeOnSelect !== undefined
      ? options.closeOnSelect
      : !multiple
  /** Подгрузка вариантов с сервера (только из JS): async (query) => [{ value, label }]. */
  const load = ctx.options?.load
  const d = createDisposer()
  const id = uid('select')
  const placeholderText = () =>
    options.placeholder ||
    (native.options[0]?.value === '' ? native.options[0].textContent.trim() : '') ||
    t('kit.select.placeholder')

  // ─── Разметка ─────────────────────────────────────────────────────────────
  const root = document.createElement('div')
  root.className = `select${multiple ? ' select--multiple' : ''}`
  root.innerHTML = `
    <div class="select__control">
      <ul class="select__chips" hidden></ul>
      <span class="select__value"></span>
      <input class="select__input" type="text" role="combobox" autocomplete="off" spellcheck="false"
             aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" aria-haspopup="listbox">
      <button class="select__clear" type="button" tabindex="-1" hidden>×</button>
      <span class="select__arrow" aria-hidden="true"></span>
    </div>
    <div class="select__dropdown" id="${id}-dropdown">
      <ul class="select__list" id="${id}-list" role="listbox"></ul>
      <p class="select__empty" hidden></p>
    </div>
    <span class="visually-hidden" aria-live="polite"></span>`
  /** @type {HTMLElement} */
  const control = root.querySelector('.select__control')
  /** @type {HTMLElement} */
  const chips = root.querySelector('.select__chips')
  /** @type {HTMLElement} */
  const valueBox = root.querySelector('.select__value')
  /** @type {HTMLInputElement} */
  const input = root.querySelector('.select__input')
  /** @type {HTMLButtonElement} */
  const clear = root.querySelector('.select__clear')
  /** @type {HTMLElement} */
  const dropdown = root.querySelector('.select__dropdown')
  /** @type {HTMLElement} */
  const list = root.querySelector('.select__list')
  /** @type {HTMLElement} */
  const empty = root.querySelector('.select__empty')
  /** @type {HTMLElement} */
  const live = root.querySelector('[aria-live]')
  if (multiple) list.setAttribute('aria-multiselectable', 'true')
  if (canPopover) dropdown.popover = 'manual'

  // Подпись поля: <label> вокруг select или label[for] — переносим на input.
  /** @type {HTMLLabelElement | null} */
  const labelEl =
    native.closest('label') ?? (native.id ? document.querySelector(`label[for="${CSS.escape(native.id)}"]`) : null)
  const labelText =
    labelEl?.querySelector('.field__label')?.textContent.trim() ||
    native.getAttribute('aria-label') ||
    labelEl?.textContent.trim()
  if (labelText) {
    input.setAttribute('aria-label', labelText)
    list.setAttribute('aria-label', labelText)
  }
  if (native.id) {
    // label[for] теперь ведёт на видимое поле.
    input.id = `${native.id}-input`
    if (labelEl?.htmlFor === native.id) labelEl.htmlFor = input.id
  }
  input.readOnly = !options.search
  if (native.required) input.setAttribute('aria-required', 'true')

  native.after(root)
  native.classList.add('select__native')
  native.tabIndex = -1
  native.setAttribute('aria-hidden', 'true')
  d.add(() => {
    root.remove()
    native.classList.remove('select__native')
    native.removeAttribute('tabindex')
    native.removeAttribute('aria-hidden')
    if (labelEl && input.id && labelEl.htmlFor === input.id) labelEl.htmlFor = native.id
  })

  // ─── Состояние ────────────────────────────────────────────────────────────
  let all = readOptionsList(native)
  let visible = all
  let active = -1 // индекс подсвеченного в visible
  let open = false
  let query = ''

  const selectedValues = () => Array.from(native.selectedOptions, (o) => o.value).filter((v) => v !== '')
  const labelOf = (value) => all.find((o) => o.value === value)?.label ?? value

  function renderValue() {
    const values = selectedValues()
    if (multiple) {
      chips.hidden = values.length === 0
      chips.replaceChildren(
        ...values.map((value) => {
          const chip = document.createElement('li')
          chip.className = 'select__chip'
          const text = document.createElement('span')
          text.textContent = labelOf(value)
          const remove = document.createElement('button')
          remove.type = 'button'
          remove.tabIndex = -1
          remove.className = 'select__chip-remove'
          remove.dataset.value = value
          remove.setAttribute('aria-label', t('kit.select.remove', { label: labelOf(value) }))
          remove.textContent = '×'
          chip.append(text, remove)
          return chip
        }),
      )
      valueBox.textContent = ''
      input.placeholder = values.length ? '' : placeholderText()
    } else {
      const value = values[0]
      valueBox.textContent = query ? '' : value !== undefined ? labelOf(value) : ''
      input.placeholder = value === undefined ? placeholderText() : ''
    }
    root.classList.toggle('has-value', values.length > 0)
    clear.hidden = !options.clearable || values.length === 0
    clear.setAttribute('aria-label', t('kit.select.clear'))
  }

  function renderList() {
    const values = new Set(selectedValues())
    const full = multiple && options.max > 0 && values.size >= options.max
    const items = []
    let group = null
    visible.forEach((option, index) => {
      if (option.group && option.group !== group) {
        group = option.group
        const header = document.createElement('li')
        header.className = 'select__group'
        header.setAttribute('role', 'presentation')
        header.textContent = group
        items.push(header)
      }
      const li = document.createElement('li')
      li.className = 'select__option'
      li.id = `${id}-opt-${index}`
      li.setAttribute('role', 'option')
      li.dataset.index = String(index)
      const selected = values.has(option.value)
      li.setAttribute('aria-selected', String(selected))
      const disabled = option.disabled || (full && !selected)
      if (disabled) li.setAttribute('aria-disabled', 'true')
      li.classList.toggle('is-active', index === active)
      highlight(option.label, query).forEach((part, i) => {
        if (i === 1) {
          const mark = document.createElement('mark')
          mark.textContent = part
          li.append(mark)
        } else li.append(document.createTextNode(part))
      })
      items.push(li)
    })
    list.replaceChildren(...items)
    empty.hidden = visible.length > 0
    empty.textContent = t('kit.select.empty')
    if (active >= 0) input.setAttribute('aria-activedescendant', `${id}-opt-${active}`)
    else input.removeAttribute('aria-activedescendant')
    if (open)
      live.textContent = visible.length ? t('kit.select.results', { count: visible.length }) : t('kit.select.empty')
  }

  // ─── Позиция выпадающего списка ──────────────────────────────────────────
  function place() {
    const rect = control.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom
    const height = Math.min(dropdown.scrollHeight || 320, 320)
    const up = below < height + 8 && rect.top > below
    root.classList.toggle('is-up', up)
    Object.assign(dropdown.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      top: up ? 'auto' : `${rect.bottom + 4}px`,
      bottom: up ? `${window.innerHeight - rect.top + 4}px` : 'auto',
      margin: '0',
    })
  }

  // ─── Открыть/закрыть ─────────────────────────────────────────────────────
  function setOpen(next) {
    if (next === open || native.disabled) return
    open = next
    root.classList.toggle('is-open', open)
    input.setAttribute('aria-expanded', String(open))
    if (open) {
      visible = filterOptions(all, query)
      const first = selectedValues()[0]
      active = Math.max(
        0,
        visible.findIndex((o) => o.value === first),
      )
      if (visible[active]?.disabled) active = visible.findIndex((o) => !o.disabled)
      renderList()
      if (canPopover) dropdown.showPopover()
      place()
      scrollToActive()
      window.addEventListener('scroll', place, true)
      window.addEventListener('resize', place)
    } else {
      if (canPopover && dropdown.matches(':popover-open')) dropdown.hidePopover()
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      query = ''
      input.value = ''
      active = -1
      input.removeAttribute('aria-activedescendant')
      renderValue()
    }
  }
  d.add(() => setOpen(false))

  function scrollToActive() {
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
  }

  // ─── Выбор ────────────────────────────────────────────────────────────────
  function commit() {
    // Сообщаем форме и всем, кто слушает настоящий select.
    native.dispatchEvent(new Event('input', { bubbles: true }))
    native.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function choose(index) {
    const option = visible[index]
    if (!option) return
    const nativeOption = Array.from(native.options).find((o) => o.value === option.value)
    if (!nativeOption || nativeOption.disabled) return
    if (multiple) {
      const full = options.max > 0 && selectedValues().length >= options.max
      if (!nativeOption.selected && full) return
      nativeOption.selected = !nativeOption.selected
    } else nativeOption.selected = true
    commit()
    if (closeOnSelect) setOpen(false)
    else {
      if (options.search && query) {
        // Мультивыбор с поиском: выбрали — очищаем запрос, чтобы искать дальше.
        query = ''
        input.value = ''
        visible = all
        active = visible.indexOf(option)
      }
      renderValue()
      renderList()
    }
  }

  function removeValue(value) {
    const option = Array.from(native.options).find((o) => o.value === value)
    if (option) option.selected = false
    commit()
  }

  function clearAll() {
    Array.from(native.options).forEach((o) => (o.selected = false))
    if (!multiple && native.options[0]?.value === '') native.options[0].selected = true
    commit()
  }

  function move(step) {
    if (!visible.length) return
    let next = active
    for (let i = 0; i < visible.length; i++) {
      next = (next + step + visible.length) % visible.length
      if (!visible[next].disabled) break
    }
    active = next
    renderList()
    scrollToActive()
  }

  // ─── События ──────────────────────────────────────────────────────────────
  d.listen(control, 'mousedown', (event) => {
    if (event.target.closest('.select__chip-remove, .select__clear')) return
    event.preventDefault() // не терять фокус поля
    input.focus()
    setOpen(!open)
  })
  d.listen(control, 'click', (event) => {
    const remove = event.target.closest('.select__chip-remove')
    if (remove) {
      event.stopPropagation()
      removeValue(remove.dataset.value)
      input.focus()
    } else if (event.target.closest('.select__clear')) {
      clearAll()
      input.focus()
    }
  })
  d.listen(list, 'mousedown', (event) => event.preventDefault())
  d.listen(list, 'click', (event) => {
    const li = event.target.closest('[role="option"]')
    if (li && li.getAttribute('aria-disabled') !== 'true') choose(Number(li.dataset.index))
  })
  d.listen(list, 'mousemove', (event) => {
    const li = event.target.closest('[role="option"]')
    if (li && Number(li.dataset.index) !== active) {
      active = Number(li.dataset.index)
      list.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'))
      li.classList.add('is-active')
      input.setAttribute('aria-activedescendant', li.id)
    }
  })

  let typeahead = ''
  let typeaheadTimer = 0
  d.listen(input, 'keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (!open) setOpen(true)
        else move(event.key === 'ArrowDown' ? 1 : -1)
        return
      case 'Home':
      case 'End':
        if (!open) return
        event.preventDefault()
        active = event.key === 'Home' ? -1 : visible.length
        move(event.key === 'Home' ? 1 : -1)
        return
      case 'Enter':
        if (!open) return
        event.preventDefault() // не отправлять форму
        choose(active)
        return
      case ' ':
        if (options.search && open) return // пробел — часть запроса
        event.preventDefault()
        if (!open) setOpen(true)
        else choose(active)
        return
      case 'Escape':
        if (open) {
          event.preventDefault()
          event.stopPropagation() // не закрыть заодно модалку
          setOpen(false)
        }
        return
      case 'Tab':
        setOpen(false)
        return
      case 'Backspace':
        if (multiple && !input.value) {
          const values = selectedValues()
          if (values.length) removeValue(values.at(-1))
        }
        return
      default:
        // Без поиска: буквы — перейти к варианту, начинающемуся с них (как у системного select).
        if (!options.search && event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          typeahead += normalize(event.key)
          clearTimeout(typeaheadTimer)
          typeaheadTimer = window.setTimeout(() => (typeahead = ''), 600)
          if (!open) setOpen(true)
          const index = visible.findIndex((o) => !o.disabled && normalize(o.label).startsWith(typeahead))
          if (index >= 0) {
            active = index
            renderList()
            scrollToActive()
          }
        }
    }
  })
  d.add(() => clearTimeout(typeaheadTimer))

  const runLoad = debounce(async (q) => {
    if (!load) return
    root.classList.add('is-loading')
    try {
      const items = await load(q)
      if (q !== query) return // пока грузилось, запрос поменялся
      const keep = new Set(selectedValues())
      Array.from(native.options).forEach((o) => !keep.has(o.value) && o.value !== '' && o.remove())
      for (const item of items) {
        if (!keep.has(String(item.value))) native.add(new Option(item.label, item.value))
      }
      all = readOptionsList(native)
      visible = all.filter((o) => !keep.has(o.value) || normalize(o.label).includes(normalize(q)))
      active = visible.length ? 0 : -1
      renderList()
    } catch (error) {
      console.error('[kit] select: не удалось загрузить варианты', error)
    } finally {
      root.classList.remove('is-loading')
    }
  }, 250)
  d.add(runLoad.cancel)

  d.listen(input, 'input', () => {
    if (!options.search) return
    query = input.value
    if (!open) setOpen(true)
    valueBox.textContent = ''
    visible = filterOptions(all, query)
    active = visible.findIndex((o) => !o.disabled)
    renderList()
    if (load) runLoad(query)
  })

  d.listen(input, 'blur', () => {
    setOpen(false)
    // Модуль form проверяет поле «при уходе» по событию настоящего select.
    native.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
  d.listen(document, 'pointerdown', (event) => {
    if (open && !root.contains(event.target)) setOpen(false)
  })

  // Изменения снаружи: reset формы, выбор из кода, модуль form шлёт change.
  d.listen(native, 'change', () => {
    renderValue()
    if (open) renderList()
  })
  // Форма фокусирует первое неверное поле — это скрытый select. Переводим фокус.
  d.listen(native, 'focus', () => input.focus())
  // Ошибка формы (aria-invalid, aria-describedby) — на видимое поле.
  if (typeof MutationObserver !== 'undefined') {
    const sync = () => {
      for (const attr of ['aria-invalid', 'aria-describedby']) {
        if (native.hasAttribute(attr)) input.setAttribute(attr, native.getAttribute(attr))
        else input.removeAttribute(attr)
      }
      root.classList.toggle('is-invalid', native.getAttribute('aria-invalid') === 'true')
      root.classList.toggle('is-disabled', native.disabled)
      input.disabled = native.disabled
    }
    const observer = new MutationObserver(sync)
    observer.observe(native, { attributes: true, attributeFilter: ['aria-invalid', 'aria-describedby', 'disabled'] })
    d.add(() => observer.disconnect())
    sync()
  }

  d.add(
    onLocaleChange(() => {
      renderValue()
      if (open) renderList()
    }),
  )

  renderValue()

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    get value() {
      return multiple ? selectedValues() : (selectedValues()[0] ?? '')
    },
    /** Выбрать значение(я) из кода. */
    setValue(value) {
      const values = new Set([].concat(value).map(String))
      Array.from(native.options).forEach((o) => (o.selected = values.has(o.value)))
      commit()
    },
    /** Перечитать варианты из <select> (после того как их поменяли в DOM). */
    refresh() {
      all = readOptionsList(native)
      visible = filterOptions(all, query)
      renderValue()
      if (open) renderList()
    },
    clear: clearAll,
    destroy: d.dispose,
  }
}
