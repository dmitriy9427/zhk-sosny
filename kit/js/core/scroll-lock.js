/**
 * Блокировка прокрутки страницы (открыто меню, модалка).
 *
 * ─── Какие баги здесь закрыты ───────────────────────────────────────────────
 * 1. «Прыжок» вёрстки: при overflow:hidden исчезает полоса прокрутки, и
 *    страница сдвигается вправо на её ширину. Компенсируем padding-right
 *    через CSS-переменную --scrollbar-width (её же можно использовать для
 *    фиксированной шапки: `padding-right: var(--scrollbar-width, 0)`).
 * 2. Вложенные блокировки: меню открыло модалку, модалка закрылась — меню
 *    ещё открыто, прокрутка должна остаться заблокированной. Поэтому счётчик:
 *    разблокируем, только когда все, кто блокировал, отпустили.
 * 3. Плавный скролл (Lenis) не слушается overflow:hidden — его надо
 *    остановить отдельно. Передайте экземпляр через setScrollEngine().
 * 4. iOS Safari прокручивает body даже с overflow:hidden. Класс
 *    .is-scroll-locked в kit/scss/base/_a11y.scss добавляет
 *    `overscroll-behavior: none` и `touch-action: none` на html — этого хватает
 *    для современных iOS (16+). Для старых — см. docs/troubleshooting.md.
 * @module kit/core/scroll-lock
 */

let locks = 0
let engine = null

/** Подключить плавный скролл, чтобы его тоже останавливать (делает createApp). */
export function setScrollEngine(instance) {
  engine = instance
}

export const isScrollLocked = () => locks > 0

export function lockScroll() {
  locks += 1
  if (locks > 1) return
  const root = document.documentElement
  const width = window.innerWidth - root.clientWidth
  root.style.setProperty('--scrollbar-width', `${width}px`)
  root.classList.add('is-scroll-locked')
  engine?.stop?.()
}

export function unlockScroll() {
  if (locks === 0) return // лишний вызов не должен уводить счётчик в минус
  locks -= 1
  if (locks > 0) return
  const root = document.documentElement
  root.classList.remove('is-scroll-locked')
  root.style.removeProperty('--scrollbar-width')
  engine?.start?.()
}

/** Сбросить всё (тесты, смена страницы). */
export function resetScrollLock() {
  locks = 1
  unlockScroll()
}
