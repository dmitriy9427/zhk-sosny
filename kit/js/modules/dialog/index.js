/**
 * Модальное окно на нативном <dialog>.
 *
 *   <button data-dialog-open="callback">Заказать звонок</button>
 *   <a href="#callback">Заказать звонок</a>          ← ссылка тоже открывает
 *   https://site.ru/contacts#callback               ← и адрес: окно откроется само
 *   <dialog id="callback" class="dialog" data-module="dialog" aria-labelledby="callback-title">
 *     <div class="dialog__box">
 *       <button class="dialog__close" data-dialog-close aria-label="Закрыть">×</button>
 *       <h2 id="callback-title">Заказать звонок</h2> …
 *     </div>
 *   </dialog>
 *
 * ─── Почему <dialog>, а не div ──────────────────────────────────────────────
 * showModal() бесплатно даёт то, что на div делается сотней строк и всегда с
 * багами: верхний слой поверх всего (никаких войн z-index), inert для остальной
 * страницы, удержание фокуса, Esc, ::backdrop, возврат фокуса.
 *
 * ─── Что добавляет модуль ───────────────────────────────────────────────────
 * - открытие по кнопкам [data-dialog-open="id"] в любом месте страницы
 *   (делегирование: работает и для кнопок, подгруженных позже);
 * - блокировку прокрутки страницы (нативный dialog её не блокирует!);
 * - анимацию закрытия (нативный close() убирает окно мгновенно);
 * - закрытие кликом по затемнению;
 * - события dialog:open / dialog:close на элементе;
 * - связь с адресной строкой (настройка hash, по умолчанию включена):
 *   открытие добавляет #id в адрес, закрытие убирает. Поэтому:
 *     · ссылку /contacts#callback можно отправить — окно откроется сразу;
 *     · после перезагрузки окно снова открыто;
 *     · кнопка/жест «Назад» на телефоне закрывает окно, а не уводит со страницы.
 *   Открытие делает pushState (новая запись истории) — именно она снимается
 *   «Назад». Если окно открыто по ссылке извне, записи «до» нет — при
 *   закрытии хеш просто стирается (replaceState), страница остаётся.
 *
 * Баги, закрытые здесь: окно не закрывается, если у него нет CSS-анимации
 * (ждём animationend, но с таймаутом-страховкой); Esc во время анимации
 * закрытия; двойная блокировка прокрутки при повторном open().
 * @module kit/modules/dialog
 */
import { createDisposer } from '../../core/lifecycle.js'
import { readOptions } from '../../core/options.js'
import { delegate } from '../../core/dom.js'
import { lockScroll, unlockScroll } from '../../core/scroll-lock.js'
import { getHash, setHash } from '../../core/url.js'

const DEFAULTS = {
  /** Закрывать кликом по затемнению вокруг окна. */
  closeOnBackdrop: true,
  /** Максимальная длительность анимации закрытия, мс (страховка). */
  closeTimeout: 400,
  /** Писать #id в адрес при открытии и открываться по #id (нужен id у <dialog>). */
  hash: true,
}

export default function dialog(el, ctx = {}) {
  if (el.tagName !== 'DIALOG') throw new Error('[kit] dialog: модуль ставится на элемент <dialog>')
  if (!el.id) console.warn('[kit] dialog: без id не получится открыть окно кнопкой [data-dialog-open]', el)

  const options = readOptions(el, 'dialog', DEFAULTS, ctx.options)
  const d = createDisposer()
  let opener = null
  let closing = null
  let locked = false
  // Мы ли добавили запись в историю (тогда закрытие = history.back()).
  let pushed = false
  const useHash = options.hash && Boolean(el.id)

  function open(trigger, { fromUrl = false } = {}) {
    if (el.open && !closing) return
    if (closing) finishClose() // открыли снова во время анимации закрытия
    opener = trigger ?? document.activeElement
    el.showModal()
    if (useHash && !fromUrl && getHash() !== el.id) {
      setHash(el.id, { push: true })
      pushed = true
    }
    if (!locked) {
      lockScroll()
      locked = true
    }
    el.dispatchEvent(new CustomEvent('dialog:open', { bubbles: true }))
  }

  function finishClose() {
    clearTimeout(closing)
    closing = null
    el.classList.remove('is-closing')
    el.close()
  }

  function close() {
    if (!el.open || closing) return
    el.classList.add('is-closing')
    const done = () => {
      el.removeEventListener('animationend', done)
      if (closing) finishClose()
    }
    el.addEventListener('animationend', done)
    // Нет анимации (или она отключена reduced motion) — закрываемся по таймеру.
    closing = setTimeout(done, ctx.reduced ? 0 : options.closeTimeout)
  }

  // Нативное событие close — окно закрыто любым способом (в т.ч. form method="dialog").
  d.listen(el, 'close', () => {
    if (locked) {
      unlockScroll()
      locked = false
    }
    // Возвращаем фокус кнопке, которая открыла окно (если она ещё на странице).
    if (opener?.isConnected) opener.focus?.({ preventScroll: true })
    opener = null
    if (useHash && getHash() === el.id) {
      if (pushed)
        history.back() // снимаем свою запись — «Назад» после этого ведёт куда надо
      else setHash('') // окно открыли по ссылке извне — просто стираем хеш
    }
    pushed = false
    el.dispatchEvent(new CustomEvent('dialog:close', { bubbles: true, detail: { returnValue: el.returnValue } }))
  })

  // Esc: браузер шлёт cancel и закрывает мгновенно — перехватываем ради анимации.
  d.listen(el, 'cancel', (event) => {
    event.preventDefault()
    close()
  })

  d.listen(el, 'click', (event) => {
    if (event.target.closest('[data-dialog-close]')) return close()
    // Клик по самому <dialog> (а не по содержимому) = клик по затемнению.
    // Работает, если у .dialog__box есть фон, а у dialog — нет padding.
    if (options.closeOnBackdrop && event.target === el) close()
  })

  if (el.id) {
    const id = CSS.escape(el.id)
    d.add(
      delegate(document, 'click', `[data-dialog-open="${id}"], a[href="#${id}"]`, (event, trigger) => {
        event.preventDefault()
        open(trigger)
      }),
    )
  }

  if (useHash) {
    // Адрес поменялся извне (Назад/Вперёд, ручной ввод #id) — синхронизируем окно.
    const sync = () => {
      const wanted = getHash() === el.id
      if (wanted && (!el.open || closing)) open(null, { fromUrl: true })
      else if (!wanted && el.open) {
        pushed = false // запись уже снята браузером — второй раз back() не делаем
        close()
      }
    }
    d.listen(window, 'popstate', sync)
    d.listen(window, 'hashchange', sync)
    if (getHash() === el.id) open(null, { fromUrl: true })
  }

  d.add(() => {
    clearTimeout(closing)
    if (el.open) el.close()
    if (locked) unlockScroll()
  })

  return {
    open: (trigger) => open(trigger),
    close,
    get isOpen() {
      return el.open && !closing
    },
    destroy: d.dispose,
  }
}
