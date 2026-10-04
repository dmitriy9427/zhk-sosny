/**
 * Запуск модулей на всех страницах: кит + модули ЖК.
 * Свой модуль: src/modules/<имя>/index.ts + строка в projectModules.
 */
import { createApp } from 'kit/js/core/app.js'
import { lazy } from 'kit/js/core/registry.js'
import { kitModules } from 'kit/js/modules/index.js'
import { registerSchema, s } from 'kit/js/form/index.js'
import { toast } from 'kit/js/modules/toast/index.js'
import favorites from '../modules/favorites/index'

registerSchema(
  'visit',
  s.object({
    name: s.string().trim().min(2, 'Как к вам обращаться?'),
    phone: s.string().phone(),
    time: s.enum(['weekday', 'weekend', 'online'], 'Выберите удобное время'),
    consent: s.boolean().isTrue('Нужно согласие на обработку данных'),
  }),
)

const projectModules = {
  favorites,
  building3d: lazy(() => import('../modules/building3d/index')),
  catalog: lazy(() => import('../modules/catalog/index')),
  mortgage: lazy(() => import('../modules/mortgage/index')),
}

createApp({ modules: { ...kitModules, ...projectModules }, smooth: true })

// Кнопка «Записаться на показ» со страницы квартиры передаёт её номер в форму.
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-visit-flat]')
  const label = document.querySelector<HTMLElement>('.dialog__flat')
  const input = document.querySelector<HTMLInputElement>('#visit [name="flat"]')
  if (!label || !input) return
  if (button?.dataset.visitFlat) {
    label.hidden = false
    label.textContent = button.dataset.visitFlat
    input.value = button.dataset.visitFlat
  } else if ((event.target as HTMLElement).closest('[data-dialog-open="visit"]')) {
    label.hidden = true
    input.value = ''
  }
})

// Демо-режим: бэкенда нет — показываем успех без отправки.
// В реальном проекте уберите этот обработчик и добавьте форме data-form-ajax и action.
document.addEventListener('form:submit', (event) => {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  toast('Заявка принята! Это демо — на самом деле она никуда не отправлена.', { type: 'success', duration: 5000 })
  form.reset()
  form.closest('dialog')?.querySelector<HTMLElement>('[data-dialog-close]')?.click()
})

if (import.meta.env.DEV) {
  import('kit/devtools/index.js').then((m) => m.installDevtools())
}
