/**
 * Избранные квартиры: кнопки ♥, счётчик в шапке, хранение в браузере.
 *
 *   <button data-favorite="1-5-3" aria-pressed="false">♥</button>   ← где угодно
 *   <a href="/favorites/">Избранное <span data-favorites-count></span></a>
 *
 * Модуль ставится один раз (на <body>), кнопки обслуживаются делегированием —
 * в том числе карточки, которые каталог дорисовал позже.
 * Выбор хранится в localStorage (переживает перезагрузку) и синхронизируется
 * между вкладками (событие storage).
 */
import { createDisposer } from 'kit/js/core/lifecycle.js'
import { delegate } from 'kit/js/core/dom.js'
import { readStorage, writeStorage } from 'kit/js/core/storage.js'
import { toast } from 'kit/js/modules/toast/index.js'

const KEY = 'favorites'

export const getFavorites = (): string[] => {
  const value = readStorage(KEY, [])
  return Array.isArray(value) ? value : []
}

export function toggleFavorite(id: string): boolean {
  const list = getFavorites()
  const on = !list.includes(id)
  writeStorage(KEY, on ? [...list, id] : list.filter((x) => x !== id))
  document.dispatchEvent(new CustomEvent('favorites:change'))
  return on
}

/** Отрисовать состояние всех кнопок и счётчиков на странице. */
export function syncFavorites(root: ParentNode = document) {
  const list = getFavorites()
  root.querySelectorAll<HTMLElement>('[data-favorite]').forEach((button) => {
    const on = list.includes(button.dataset.favorite ?? '')
    button.setAttribute('aria-pressed', String(on))
    button.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное')
  })
  document.querySelectorAll<HTMLElement>('[data-favorites-count]').forEach((el) => {
    el.textContent = list.length ? String(list.length) : ''
    el.hidden = list.length === 0
  })
}

export default function favorites(root: HTMLElement) {
  const d = createDisposer()
  d.add(
    delegate(root, 'click', '[data-favorite]', (event: Event, button: HTMLElement) => {
      event.preventDefault()
      event.stopPropagation()
      const on = toggleFavorite(button.dataset.favorite ?? '')
      toast(on ? 'Добавлено в избранное' : 'Убрано из избранного', { type: on ? 'success' : 'info', duration: 1800 })
    }),
  )
  d.listen(document, 'favorites:change', () => syncFavorites())
  d.listen(document, 'catalog:render', () => syncFavorites())
  d.listen(window, 'storage', (event: StorageEvent) => event.key === KEY && syncFavorites())
  syncFavorites()
  return { destroy: d.dispose }
}
