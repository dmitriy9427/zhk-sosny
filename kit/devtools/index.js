/**
 * Dev-панель: инструменты вёрстки, которые НИКОГДА не попадают в продакшн.
 *
 * Подключение (уже сделано в стартерах):
 *   if (import.meta.env.DEV) import('kit/devtools').then((m) => m.installDevtools())
 * Условие import.meta.env.DEV при сборке становится false, и сборщик
 * выбрасывает этот код. Если всё же попадёт — сборку остановит
 * kit/vite/devtools-guard.js (ищет метку DEVTOOLS_MARKER).
 *
 * Открыть панель: кнопка ⚙ в левом нижнем углу или Shift+Alt+K.
 * (Слева — потому что справа внизу обычно живут «Наверх», чаты и виджеты.)
 *
 * | инструмент   | зачем |
 * |--------------|-------|
 * | Сетка        | колонки макета поверх страницы — проверить выравнивание |
 * | Брейкпоинт   | текущий брейкпоинт и ширина окна в углу экрана |
 * | FPS          | частота кадров: < 50 — анимация тормозит |
 * | Контуры      | рамки у всех блоков — видно лишние отступы и вылеты |
 * | Переполнение | найти, что вылезает за край и даёт горизонтальный скролл |
 * | Доступность  | img без alt, кнопки без подписи, поля без label, h1…h6 |
 * | Макет        | картинка макета поверх вёрстки (pixel perfect) |
 * | Модули       | какие data-module есть на странице и запущены ли |
 * | Сдвиги (CLS) | в консоль — элементы, которые «прыгают» при загрузке |
 *
 * Панель живёт в Shadow DOM: стили проекта не ломают панель, а стили панели
 * не протекают на страницу.
 * @module kit/devtools
 */
import { DEVTOOLS_MARKER } from '../vite/devtools-guard.js'
import { getInstance } from '../js/core/registry.js'
import { readStorage, writeStorage } from '../js/core/storage.js'
import { checkA11y, findOverflow, listModules } from './checks.js'
import { PANEL_CSS, PAGE_CSS } from './styles.js'

const STATE_KEY = 'kit-devtools'

export function installDevtools() {
  if (window[DEVTOOLS_MARKER]) return window[DEVTOOLS_MARKER]
  const state = readStorage(STATE_KEY, {}) ?? {}
  const save = () => writeStorage(STATE_KEY, state)
  const cleanups = new Map()

  const pageStyle = document.createElement('style')
  pageStyle.textContent = PAGE_CSS
  pageStyle.setAttribute('data-kit-devtools', '')
  document.head.append(pageStyle)

  const host = document.createElement('div')
  host.setAttribute('data-kit-devtools', '')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `<style>${PANEL_CSS}</style>
    <button class="fab" title="Dev-панель (Shift+Alt+K)" aria-label="Dev-панель">⚙</button>
    <div class="panel" hidden>
      <header>kit devtools <small>только в dev</small></header>
      <div class="tools"></div>
      <div class="output"></div>
    </div>
    <div class="badge" hidden></div>`
  document.body.append(host)

  const $ = (s) => shadow.querySelector(s)
  const panel = $('.panel')
  const output = $('.output')
  const badge = $('.badge')

  const togglePanel = (open = panel.hidden) => {
    panel.hidden = !open
    state.open = open
    save()
  }
  $('.fab').addEventListener('click', () => togglePanel())
  const onKey = (e) => {
    if (e.shiftKey && e.altKey && e.code === 'KeyK') togglePanel()
  }
  document.addEventListener('keydown', onKey)

  /** Показать список проблем; клик — прокрутить к элементу и подсветить. */
  function report(title, items) {
    output.innerHTML = `<h4>${title}: ${items.length || 'всё чисто ✓'}</h4>`
    const list = document.createElement('ol')
    items.slice(0, 50).forEach(({ el, message }) => {
      const li = document.createElement('li')
      const tag = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList[0] ? '.' + el.classList[0] : ''}`
      li.innerHTML = `<code></code> <span></span>`
      li.querySelector('code').textContent = tag
      li.querySelector('span').textContent = message
      li.addEventListener('click', () => {
        el.scrollIntoView({ block: 'center' })
        el.setAttribute('data-kit-highlight', '')
        setTimeout(() => el.removeAttribute('data-kit-highlight'), 2000)
        console.info('[devtools]', message, el)
      })
      list.append(li)
    })
    output.append(list)
    console.groupCollapsed(`[devtools] ${title}: ${items.length}`)
    items.forEach(({ el, message }) => console.info(message, el))
    console.groupEnd()
  }

  // ─── Инструменты-переключатели ──────────────────────────────────────────
  const toggles = {
    grid: {
      label: 'Сетка',
      on() {
        const grid = document.createElement('div')
        grid.className = 'kit-dev-grid'
        grid.setAttribute('data-kit-devtools', '')
        const columns = Number(getComputedStyle(document.documentElement).getPropertyValue('--grid-columns')) || 12
        grid.innerHTML = `<div>${'<span></span>'.repeat(columns)}</div>`
        grid.style.setProperty('--cols', String(columns))
        document.body.append(grid)
        return () => grid.remove()
      },
    },
    breakpoint: {
      label: 'Брейкпоинт',
      on() {
        const update = () => {
          const style = getComputedStyle(document.documentElement)
          const width = window.innerWidth
          const names = ['sm', 'md', 'lg', 'xl', 'xxl'].filter(
            (n) => width >= parseFloat(style.getPropertyValue(`--bp-${n}`)),
          )
          badge.textContent = `${names.at(-1) ?? 'xs'} · ${width}px`
        }
        badge.hidden = false
        update()
        window.addEventListener('resize', update)
        return () => {
          badge.hidden = true
          window.removeEventListener('resize', update)
        }
      },
    },
    fps: {
      label: 'FPS',
      on() {
        const meter = document.createElement('div')
        meter.className = 'fps'
        shadow.append(meter)
        let frames = 0
        let last = performance.now()
        let worst = 0
        let prev = last
        let raf = 0
        const loop = (now) => {
          frames++
          worst = Math.max(worst, now - prev)
          prev = now
          if (now - last >= 1000) {
            meter.textContent = `${frames} fps · худший кадр ${Math.round(worst)} мс`
            meter.classList.toggle('bad', frames < 50)
            frames = 0
            worst = 0
            last = now
          }
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
        return () => {
          cancelAnimationFrame(raf)
          meter.remove()
        }
      },
    },
    outline: {
      label: 'Контуры',
      on() {
        document.documentElement.classList.add('kit-dev-outline')
        return () => document.documentElement.classList.remove('kit-dev-outline')
      },
    },
    mockup: {
      label: 'Макет',
      on() {
        const box = document.createElement('div')
        box.className = 'mockup-controls'
        box.innerHTML = `<label>Файл <input type="file" accept="image/*"></label>
          <label>Прозрачность <input type="range" min="0" max="1" step="0.05" value="${state.mockOpacity ?? 0.5}"></label>
          <label><input type="checkbox" ${state.mockDiff ? 'checked' : ''}> разница</label>`
        $('.tools').after(box)
        const img = document.createElement('img')
        img.className = 'kit-dev-mockup'
        img.setAttribute('data-kit-devtools', '')
        img.alt = ''
        const apply = () => {
          img.style.opacity = state.mockOpacity ?? 0.5
          img.style.mixBlendMode = state.mockDiff ? 'difference' : 'normal'
        }
        const saved = sessionStorage.getItem('kit-mockup')
        if (saved) img.src = saved
        apply()
        document.body.append(img)
        box.querySelector('[type=file]').addEventListener('change', (e) => {
          const file = /** @type {HTMLInputElement} */ (e.target).files[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            img.src = String(reader.result)
            try {
              sessionStorage.setItem('kit-mockup', String(reader.result))
            } catch {
              console.info('[devtools] макет слишком большой, чтобы запомнить — после перезагрузки выберите снова')
            }
          }
          reader.readAsDataURL(file)
        })
        box.querySelector('[type=range]').addEventListener('input', (e) => {
          state.mockOpacity = Number(/** @type {HTMLInputElement} */ (e.target).value)
          save()
          apply()
        })
        box.querySelector('[type=checkbox]').addEventListener('change', (e) => {
          state.mockDiff = /** @type {HTMLInputElement} */ (e.target).checked
          save()
          apply()
        })
        return () => {
          img.remove()
          box.remove()
        }
      },
    },
    cls: {
      label: 'Сдвиги (CLS)',
      on() {
        if (typeof PerformanceObserver === 'undefined') return () => {}
        const observer = new PerformanceObserver((list) => {
          for (const entry of /** @type {LayoutShift[]} */ (list.getEntries())) {
            if (entry.hadRecentInput) continue
            const nodes = entry.sources?.map((s) => s.node).filter(Boolean) ?? []
            console.warn(
              `[devtools] сдвиг вёрстки ${entry.value.toFixed(3)} — задайте размеры (width/height, aspect-ratio):`,
              ...nodes,
            )
          }
        })
        try {
          observer.observe({ type: 'layout-shift', buffered: true })
        } catch {
          console.info('[devtools] браузер не умеет layout-shift (только Chromium)')
        }
        return () => observer.disconnect()
      },
    },
  }

  // ─── Разовые проверки ────────────────────────────────────────────────────
  const actions = {
    overflow: { label: 'Переполнение', run: () => report('Вылезают за край', findOverflow()) },
    a11y: { label: 'Доступность', run: () => report('Проблемы доступности', checkA11y()) },
    modules: {
      label: 'Модули',
      run: () => {
        const items = listModules(getInstance)
        report(
          'Модули на странице',
          items.map(({ el, name, status }) => ({ el, message: `${name} — ${status}` })),
        )
      },
    },
  }

  const inputs = {}
  const set = (id, on) => {
    if (inputs[id]) inputs[id].checked = on // галочка в панели = реальное состояние
    cleanups.get(id)?.()
    cleanups.delete(id)
    if (on) cleanups.set(id, toggles[id].on())
    state[id] = on
    save()
  }

  const tools = $('.tools')
  for (const [id, tool] of Object.entries(toggles)) {
    const label = document.createElement('label')
    label.innerHTML = `<input type="checkbox"> <span></span>`
    label.querySelector('span').textContent = tool.label
    const input = label.querySelector('input')
    inputs[id] = input
    input.checked = Boolean(state[id])
    input.addEventListener('change', () => set(id, input.checked))
    tools.append(label)
    if (state[id]) set(id, true)
  }
  for (const action of Object.values(actions)) {
    const button = document.createElement('button')
    button.textContent = action.label
    button.addEventListener('click', action.run)
    tools.append(button)
  }
  if (state.open) togglePanel(true)

  const api = {
    toggles: Object.keys(toggles),
    set,
    run: (id) => actions[id].run(),
    destroy() {
      cleanups.forEach((fn) => fn())
      cleanups.clear()
      document.removeEventListener('keydown', onKey)
      host.remove()
      pageStyle.remove()
      delete window[DEVTOOLS_MARKER]
    },
  }
  window[DEVTOOLS_MARKER] = api
  console.info('%c[kit] dev-панель: ⚙ в углу или Shift+Alt+K', 'color:#7d93ff')
  return api
}
