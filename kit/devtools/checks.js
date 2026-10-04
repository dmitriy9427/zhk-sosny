/**
 * Проверки страницы для dev-панели. Чистые функции над DOM: возвращают
 * список проблем { el, message }, ничего не рисуют — легко тестировать.
 * @module kit/devtools/checks
 */

/**
 * Элементы, вылезающие за правый край экрана — причина горизонтальной
 * прокрутки на мобилке (самый частый баг адаптива). Возвращает только самые
 * «глубокие» виновники: если вылезает ребёнок, его родителя не показываем.
 * @param {number} [viewport] Ширина видимой области (по умолчанию — ширина html без полосы прокрутки).
 */
export function findOverflow(root = document.body, viewport = document.documentElement.clientWidth) {
  const result = []
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('[data-kit-devtools]')) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) continue
    if (rect.right > viewport + 1 || rect.left < -1) {
      result.push({ el, message: `вылезает на ${Math.round(Math.max(rect.right - viewport, -rect.left))}px` })
    }
  }
  // fixed-элементы (курсор, тосты) не дают прокрутки страницы — не считаем их.
  const isFixed = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).position === 'fixed') return true
    }
    return false
  }
  // Обрезан предком с overflow: hidden/clip (слайды карусели за краем) — тоже не виноват.
  const isClipped = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const { overflowX } = getComputedStyle(node)
      if (overflowX !== 'visible' && node.getBoundingClientRect().right <= viewport + 1) return true
    }
    return false
  }
  const real = result.filter((item) => !isFixed(item.el) && !isClipped(item.el))
  // Убираем предков других виновников — чинить нужно ребёнка.
  return real.filter((item) => !real.some((other) => other !== item && item.el.contains(other.el)))
}

/** Доступное имя элемента (упрощённо: текст, aria-label, aria-labelledby, title, alt картинки внутри). */
export function accessibleName(el) {
  const labelledby = el.getAttribute('aria-labelledby')
  if (labelledby) {
    return labelledby
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim()
  }
  return (
    el.getAttribute('aria-label')?.trim() ||
    el.textContent.trim() ||
    el.getAttribute('title')?.trim() ||
    el.querySelector('img[alt]')?.getAttribute('alt')?.trim() ||
    el.querySelector('svg title')?.textContent.trim() ||
    ''
  )
}

/**
 * Быстрая проверка доступности: то, что чаще всего забывают при вёрстке.
 * Это не замена полноценному аудиту (Lighthouse, axe), а «ловушка» для
 * очевидного прямо во время работы.
 */
export function checkA11y(root = document) {
  const issues = []
  const add = (el, message) => issues.push({ el, message })
  const scope = (selector) =>
    Array.from(root.querySelectorAll(selector)).filter((el) => !el.closest('[data-kit-devtools]'))

  scope('img:not([alt])').forEach((el) => add(el, 'картинка без alt (для декоративной — alt="")'))
  scope('button, a[href], [role="button"]').forEach((el) => {
    if (!accessibleName(el)) add(el, `${el.tagName.toLowerCase()} без текста и aria-label`)
  })
  scope('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea').forEach((el) => {
    const labelled =
      el.labels?.length ||
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      el.getAttribute('title')
    if (!labelled) add(el, 'поле без <label> или aria-label (placeholder — не подпись)')
  })
  scope('[tabindex]').forEach((el) => {
    if (Number(el.getAttribute('tabindex')) > 0) add(el, 'tabindex > 0 ломает порядок Tab — используйте 0 или -1')
  })

  const ids = new Map()
  scope('[id]').forEach((el) => ids.set(el.id, [...(ids.get(el.id) ?? []), el]))
  ids.forEach((els, id) => els.length > 1 && add(els[1], `повторяющийся id="${id}" (${els.length} шт.)`))

  const headings = scope('h1, h2, h3, h4, h5, h6')
  const h1 = headings.filter((h) => h.tagName === 'H1')
  if (h1.length === 0 && root === document) issues.push({ el: document.body, message: 'на странице нет <h1>' })
  if (h1.length > 1) add(h1[1], `несколько <h1> (${h1.length})`)
  headings.reduce((prev, h) => {
    const level = Number(h.tagName[1])
    if (level > prev + 1) add(h, `пропуск уровня заголовка: h${prev} → h${level}`)
    return level
  }, 1)

  if (root === document && !document.documentElement.lang) {
    issues.push({ el: document.documentElement, message: 'у <html> нет lang — скринридер читает не тем языком' })
  }
  return issues
}

/** Модули на странице и их состояние (для инспектора). */
export function listModules(getInstance, root = document) {
  return Array.from(root.querySelectorAll('[data-module]'), (el) => /** @type {HTMLElement} */ (el)).flatMap((el) =>
    el.dataset.module
      .trim()
      .split(/\s+/)
      .map((name) => {
        const instance = getInstance(el, name)
        return { el, name, status: instance === undefined ? 'не запущен' : 'работает' }
      }),
  )
}
