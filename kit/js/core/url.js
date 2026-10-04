/**
 * Состояние интерфейса в адресной строке: открытая вкладка, модалка.
 *
 * Зачем: ссылку можно отправить («открой вкладку Цены»), после перезагрузки
 * страница возвращается в то же состояние, кнопка «Назад» закрывает модалку.
 *
 * ─── Хеш или параметр? ───────────────────────────────────────────────────────
 * - #hash — для ОДНОГО объекта на странице, который «открывается» (модалка
 *   #callback). Как якорь: показал → убрал.
 * - ?param=value — для состояний, которых на странице может быть несколько
 *   и одновременно (две группы табов, фильтр). ?tab=price&faq-tab=delivery.
 * Хеш одновременно может быть только один, поэтому табы через хеш
 * конфликтуют с якорями и модалками — в ките они живут в параметрах.
 *
 * ─── replaceState или pushState ─────────────────────────────────────────────
 * replace — запись в адресе меняется, история не растёт (табы: иначе «Назад»
 * пришлось бы жать по разу на каждый клик по вкладке).
 * push — новая запись: «Назад» отменяет действие (модалка закрывается
 * жестом «назад» на телефоне — так ведут себя приложения).
 * @module kit/core/url
 */

/** Значение параметра адреса или null. */
export const getParam = (name) => new URL(location.href).searchParams.get(name)

/**
 * Записать параметр (null — удалить). Хеш и остальные параметры сохраняются.
 * @param {string} name
 * @param {string | number | null | undefined} value
 * @param {{ push?: boolean }} [options]
 */
export function setParam(name, value, { push = false } = {}) {
  const url = new URL(location.href)
  if (value === null || value === undefined || value === '') url.searchParams.delete(name)
  else url.searchParams.set(name, String(value))
  if (url.href === location.href) return
  history[push ? 'pushState' : 'replaceState'](history.state, '', url)
}

/** Текущий хеш без «#», раскодированный («#отзывы» → «отзывы»). */
export const getHash = () => decodeURIComponent(location.hash.slice(1))

/** Поставить/убрать хеш, не прокручивая страницу (в отличие от location.hash = …). */
export function setHash(value, { push = false } = {}) {
  const url = new URL(location.href)
  url.hash = value ? `#${value}` : ''
  // Пустой хеш оставляет «#» в конце адреса — убираем его.
  const href = value ? url.href : url.href.replace(/#$/, '')
  if (href === location.href) return
  history[push ? 'pushState' : 'replaceState'](history.state, '', href)
}
