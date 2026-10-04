/**
 * Тесты модулей-эффектов. В jsdom нет вёрстки и WebGL — проверяем логику,
 * разметку, классы и уборку; движение — в браузере.
 */
import { describe, expect, it, vi } from 'vitest'
import flipFilter, { keepRoomFor, matchesFilter } from './flip-filter/index.js'
import { createLightbox } from './lightbox/index.js'
import lightboxModule from './lightbox/index.js'
import hscroll, { travelDistance } from './hscroll/index.js'
import stackCards, { stickyBlocker } from './stack-cards/index.js'
import scrambleText from './scramble-text/index.js'
import drawSvg from './draw-svg/index.js'
import scrollProgress from './scroll-progress/index.js'
import cursor from './cursor/index.js'
import infiniteGallery from './infinite-gallery/index.js'
import infiniteSlider from './infinite-slider/index.js'
import { gsap } from '../core/gsap.js'
import { isScrollLocked, resetScrollLock } from '../core/scroll-lock.js'
import { createCtx, html } from '@test/helpers.js'

const motion = (extra) => createCtx({ reduced: false, ...extra })

describe('flip-filter', () => {
  it('matchesFilter (несколько категорий), keepRoomFor', () => {
    expect(matchesFilter('site landing', 'landing')).toBe(true)
    expect(matchesFilter('site', 'shop')).toBe(false)
    expect(matchesFilter('', 'all')).toBe(true)
    expect(keepRoomFor(1000, 400, 2000, 1900)).toBe(900)
    expect(keepRoomFor(1000, 400, 2000, 0)).toBe(400)
  })

  it('фильтрует карточки, пишет фильтр в адрес и читает его при загрузке', () => {
    const markup = `<section><div><button data-filter="all">Все</button><button data-filter="site">Сайты</button></div>
      <div><article data-flip-item data-category="site">1</article><article data-flip-item data-category="shop">2</article></div></section>`
    const api = flipFilter(html(markup), createCtx())
    api.apply('site')
    expect(location.search).toBe('?filter=site')
    expect(document.querySelectorAll('.is-hidden')).toHaveLength(1)
    expect(document.querySelector('[data-filter=site]').getAttribute('aria-pressed')).toBe('true')
    api.destroy()
    document.body.innerHTML = ''
    const again = flipFilter(html(markup), createCtx())
    expect(again.filter).toBe('site')
    expect(document.querySelector('[data-category=shop]').classList.contains('is-hidden')).toBe(true)
    expect(() => flipFilter(html('<div></div>'), createCtx())).toThrow(/data-filter/)
  })
})

describe('lightbox', () => {
  it('открывает картинку в окне, блокирует прокрутку, закрывается по Esc и возвращает картинку', () => {
    resetScrollLock()
    const card = html('<figure><img src="a.jpg" alt="Закат" width="400" height="300"></figure>')
    const img = card.querySelector('img')
    const lightbox = createLightbox({ reduced: true })
    lightbox.open(img, { title: 'Закат <script>', meta: '2025' })
    expect(lightbox.isOpen).toBe(true)
    expect(document.querySelector('.lightbox__frame').contains(img)).toBe(true)
    expect(document.querySelector('.lightbox__title').textContent).toBe('Закат <script>') // экранировано
    expect(isScrollLocked()).toBe(true)
    gsap.ticker.tick() // анимация длиной 0 всё равно завершается на следующем кадре
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    gsap.ticker.tick()
    expect(card.contains(img)).toBe(true)
    expect(isScrollLocked()).toBe(false)
    lightbox.destroy()
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('модуль: клик и Enter по img[data-lightbox]', () => {
    const root = html('<div><img src="a.jpg" alt="A" data-lightbox data-lightbox-title="Альфа"></div>')
    const api = lightboxModule(root, createCtx())
    const img = root.querySelector('img')
    expect(img.getAttribute('role')).toBe('button')
    img.click()
    expect(api.lightbox.isOpen).toBe(true)
    expect(document.querySelector('.lightbox__title').textContent).toBe('Альфа')
    api.destroy()
    resetScrollLock()
  })
})

describe('hscroll, stack-cards, draw-svg, scroll-progress', () => {
  it('hscroll: travelDistance, ошибка без ленты, включение и уборка', () => {
    expect(travelDistance(3000, 1200)).toBe(1800)
    expect(travelDistance(800, 1200)).toBe(0)
    expect(() => hscroll(html('<section></section>'), createCtx())).toThrow(/data-hscroll-track/)
    setMedia({ all: true }) // в jsdom matchMedia — заглушка; в браузере 'all' совпадает всегда
    const el = html(
      '<section><div data-hscroll-pin><div data-hscroll-track><article data-hscroll-card></article></div></div></section>',
    )
    const api = hscroll(el, motion())
    expect(el.classList.contains('is-active')).toBe(true)
    api.destroy()
    expect(el.classList.contains('is-active')).toBe(false)
  })

  it('stack-cards: индексы карточек и предупреждение про overflow', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrap = html(
      '<div style="overflow: hidden"><div><div data-stack-card></div><div data-stack-card></div></div></div>',
    )
    expect(stickyBlocker(wrap.firstElementChild)).toBe(wrap)
    const api = stackCards(wrap.firstElementChild, motion())
    expect(wrap.querySelectorAll('[data-stack-card]')[1].style.getPropertyValue('--stack-index')).toBe('1')
    expect(warn).toHaveBeenCalled()
    api.destroy()
  })

  it('draw-svg и scroll-progress', () => {
    const svg = html('<svg><path d="M0 0L10 10" data-draw /></svg>')
    expect(drawSvg(svg, createCtx())).toBeUndefined() // reduced — без анимации
    const api = drawSvg(svg, motion())
    api.destroy()
    const bar = html('<div></div>')
    const progress = scrollProgress(bar, createCtx())
    expect(bar.getAttribute('role')).toBe('progressbar')
    progress.destroy()
    expect(() => scrollProgress(html('<div data-scroll-progress-target="#nope"></div>'), createCtx())).toThrow(/#nope/)
  })
})

describe('scramble-text и cursor', () => {
  it('scramble-text: aria-label с итоговым текстом, destroy возвращает текст', () => {
    const el = html('<h2>Кейсы</h2>')
    const api = scrambleText(el, motion())
    expect(el.getAttribute('aria-label')).toBe('Кейсы')
    triggerIntersect(el, true)
    api.destroy()
    expect(el.textContent).toBe('Кейсы')
  })

  it('cursor: без мыши не запускается; с мышью — подсказка из data-cursor', () => {
    const el = html('<div class="cursor"></div>')
    expect(cursor(el, motion())).toBeUndefined()
    expect(el.hidden).toBe(true)
    setMedia({ '(hover: hover) and (pointer: fine)': true })
    el.hidden = false
    const api = cursor(el, motion())
    expect(document.documentElement.classList.contains('has-cursor')).toBe(true)
    const link = html('<a href="#" data-cursor="Смотреть">x</a>')
    link.dispatchEvent(new Event('pointerover', { bubbles: true }))
    expect(el.querySelector('.cursor__label').textContent).toBe('Смотреть')
    expect(el.classList.contains('has-label')).toBe(true)
    api.destroy()
    expect(document.documentElement.classList.contains('has-cursor')).toBe(false)
  })
})

describe('infinite-gallery и infinite-slider', () => {
  it('галерея: включается, предупреждает о неполном ряде, убирается', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = Array.from({ length: 5 }, () => '<figure data-gallery-item><img src="a.jpg" alt=""></figure>').join(
      '',
    )
    const el = html(
      `<section style="--gallery-columns: 3"><div data-gallery-pin><div data-gallery-viewport><div data-gallery-grid>${items}</div></div></div></section>`,
    )
    const api = infiniteGallery(el, motion({ options: { pin: false } }))
    expect(el.classList.contains('is-active')).toBe(true)
    expect(warn.mock.calls[0][0]).toContain('5 ячеек')
    api.moveBy(100, 0)
    api.destroy()
    expect(el.classList.contains('is-active')).toBe(false)
    expect(() => infiniteGallery(html('<section></section>'), createCtx())).toThrow(/data-gallery-viewport/)
  })

  it('слайдер: меньше 3 слайдов — предупреждение; иначе подпись, счётчик, кнопки', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      await infiniteSlider(
        html('<div><div data-infinite-viewport><div data-infinite-slide></div></div></div>'),
        createCtx(),
      ),
    ).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    const slides = ['А', 'Б', 'В'].map((t) => `<figure data-infinite-slide data-title="${t}"></figure>`).join('')
    const el =
      html(`<div><div data-infinite-viewport>${slides}</div><p data-infinite-title></p><p data-infinite-counter></p>
      <button data-infinite-next></button></div>`)
    const api = await infiniteSlider(el, createCtx())
    expect(el.querySelector('[data-infinite-counter]').textContent).toBe('01 / 03')
    expect(el.querySelector('[data-infinite-title]').textContent).toBe('А')
    expect(el.querySelector('[data-infinite-viewport]').tabIndex).toBe(0)
    el.querySelector('[data-infinite-next]').click()
    expect(api.index).toBe(1)
    api.destroy()
    expect(el.classList.contains('is-ready')).toBe(false)
  })
})
