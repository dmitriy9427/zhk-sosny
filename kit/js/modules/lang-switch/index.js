/**
 * Переключатель языка.
 *
 * Два режима — выберите по типу сайта:
 *
 * 1. Ссылки на языковые версии (сайты, SEO): у каждой версии свой адрес.
 *    Модуль только помечает текущий язык (aria-current) — переход делает браузер.
 *      <nav class="lang-switch" data-module="lang-switch" aria-label="Язык сайта">
 *        <a href="/" hreflang="ru" lang="ru">RU</a>
 *        <a href="/en/" hreflang="en" lang="en">EN</a>
 *      </nav>
 *
 * 2. Кнопки (приложения, кабинеты): язык меняется на лету без перезагрузки —
 *    переводятся [data-i18n] и тексты модулей кита, выбор запоминается.
 *      <div class="lang-switch" data-module="lang-switch">
 *        <button data-lang="ru">RU</button> <button data-lang="en">EN</button>
 *      </div>
 *
 * Почему для сайтов лучше ссылки: поисковик индексирует то, что лежит по
 * адресу. Язык, переключённый скриптом, он не увидит — английская версия
 * не попадёт в поиск.
 * @module kit/modules/lang-switch
 */
import { createDisposer } from '../../core/lifecycle.js'
import { getLocale, onLocaleChange, restoreLocale, setLocale } from '../../core/i18n.js'

export default function langSwitch(root) {
  const d = createDisposer()
  const buttons = Array.from(root.querySelectorAll('[data-lang]'))
  const links = Array.from(root.querySelectorAll('a[hreflang]'))

  const render = () => {
    const current = getLocale()
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === current)))
    links.forEach((a) => {
      if (a.hreflang.split('-')[0] === current) a.setAttribute('aria-current', 'true')
      else a.removeAttribute('aria-current')
    })
  }

  if (buttons.length) {
    restoreLocale()
    d.listen(root, 'click', (event) => {
      const button = event.target.closest('[data-lang]')
      if (button) setLocale(button.dataset.lang, { remember: true })
    })
  }
  d.add(onLocaleChange(render))
  render()
  return { destroy: d.dispose }
}
