import { describe, expect, it, vi } from 'vitest'
import swiperModule, { PRESETS, loopMinimum, mergeOptions, resolveBreakpoints } from './index.js'
import { createCtx, html } from '@test/helpers.js'

const slides = (n) => Array.from({ length: n }, (_, i) => `<div class="swiper-slide">${i + 1}</div>`).join('')

describe('swiper: чистые функции', () => {
  it('брейкпоинты по именам из SCSS; неизвестное имя — предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveBreakpoints({ md: { a: 1 }, 1600: { b: 2 }, huge: {} })).toEqual({ 768: { a: 1 }, 1600: { b: 2 } })
    expect(warn.mock.calls[0][0]).toContain('huge')
  })

  it('loopMinimum и mergeOptions', () => {
    expect(loopMinimum({ slidesPerView: 3 })).toBe(4)
    expect(loopMinimum({ slidesPerView: 'auto', centeredSlides: true })).toBe(3)
    expect(loopMinimum({ grid: { rows: 2 } })).toBe(Infinity)
    expect(mergeOptions({ a: { x: 1, y: 2 }, b: 1 }, { a: { y: 3 }, c: 4 })).toEqual({ a: { x: 1, y: 3 }, b: 1, c: 4 })
  })
})

describe('swiper: модуль', () => {
  it('находит стрелки в шапке секции, а не у соседнего слайдера; русские подписи', () => {
    const section = html(`<section>
      <div class="swiper-nav"><button class="swiper-button-prev"></button><button class="swiper-button-next"></button></div>
      <div class="swiper" id="a"><div class="swiper-wrapper">${slides(5)}</div></div>
    </section>`)
    const api = swiperModule(section.querySelector('#a'), createCtx())
    expect(api.swiper.navigation.nextEl).toBe(section.querySelector('.swiper-button-next'))
    expect(section.querySelector('.swiper-button-next').type).toBe('button')
    expect(api.swiper.params.a11y.nextSlideMessage).toBe('Вперёд')
    api.destroy()
  })

  it('loop при малом числе слайдов → rewind с предупреждением; reduced motion выключает автопрокрутку', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = html(
      `<div class="swiper" data-swiper-preset="center"><div class="swiper-wrapper">${slides(2)}</div></div>`,
    )
    const api = swiperModule(el, createCtx())
    expect(api.swiper.params.loop).toBe(false)
    expect(api.swiper.params.rewind).toBe(true)
    expect(warn.mock.calls[0][0]).toContain('rewind')
    api.destroy()
    const fade = html(
      `<div class="swiper" data-swiper-preset="fade"><div class="swiper-wrapper">${slides(3)}</div></div>`,
    )
    const calm = swiperModule(fade, createCtx({ reduced: true }))
    expect(calm.swiper.params.speed).toBe(0)
    expect(calm.swiper.autoplay.running).toBeFalsy()
    calm.destroy()
  })

  it('опции из атрибутов, событие смены, неизвестный пресет — ошибка', () => {
    const el = html(
      `<div class="swiper" data-swiper-options='{"spaceBetween": 7}'><div class="swiper-wrapper">${slides(4)}</div></div>`,
    )
    const api = swiperModule(el, createCtx())
    expect(api.swiper.params.spaceBetween).toBe(7)
    expect(api.swiper.params.breakpoints[1024].slidesPerView).toBe(3)
    const change = vi.fn()
    el.addEventListener('swiper:change', change)
    api.swiper.emit('slideChange')
    expect(change).toHaveBeenCalled()
    api.destroy()
    expect(() => swiperModule(html('<div data-swiper-preset="nope"></div>'), createCtx())).toThrow(/нет пресета/)
    expect(Object.keys(PRESETS)).toContain('marquee')
  })
})
