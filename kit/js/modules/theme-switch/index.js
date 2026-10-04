/**
 * Переключатель светлой/тёмной темы.
 *
 *   <button class="theme-switch" data-module="theme-switch" aria-label="Тёмная тема"></button>
 *
 * Тема = атрибут data-theme="light|dark" на <html>. Цвета обеих тем —
 * CSS-переменные (scss/base/_root.scss). Без выбора пользователя действует
 * системная тема (prefers-color-scheme).
 *
 * ─── Баг «вспышка белого» ─────────────────────────────────────────────────
 * Если тему ставит этот модуль, страница успевает отрисоваться светлой и
 * потом мигает в тёмную. Поэтому сохранённую тему ставит маленький
 * inline-скрипт в <head> ДО отрисовки (THEME_SCRIPT ниже; он уже вставлен
 * в index.html стартеров). Модуль только переключает и запоминает.
 * @module kit/modules/theme-switch
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readStorage, writeStorage } from '../../core/storage.js'

export const STORAGE_KEY = 'theme'

/** Скрипт для <head>: применить сохранённую тему до первой отрисовки. */
export const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem('${STORAGE_KEY}'));if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`

/** Текущая тема с учётом системной. */
export function currentTheme() {
  const set = document.documentElement.dataset.theme
  if (set === 'dark' || set === 'light') return set
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme
  writeStorage(STORAGE_KEY, theme)
  document.dispatchEvent(new CustomEvent('theme:change', { detail: { theme } }))
}

export default function themeSwitch(button, ctx = {}) {
  const d = createDisposer()
  const saved = readStorage(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved

  const render = () => button.setAttribute('aria-pressed', String(currentTheme() === 'dark'))
  render()
  d.listen(button, 'click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark')
    ctx.bus?.emit('theme:change', currentTheme())
  })
  d.listen(document, 'theme:change', render)
  return { destroy: d.dispose }
}
