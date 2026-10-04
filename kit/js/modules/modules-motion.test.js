/**
 * Тесты модулей с движением: появление, разбивка текста, бегущая строка,
 * слайдер, счётчик, параллакс, магнит, шапка, «наверх», видео + реестр.
 * В jsdom нет вёрстки, поэтому проверяем логику и состояния, а не пиксели.
 */
import { describe, expect, it, vi } from 'vitest'
import { gsap, ScrollTrigger } from '../core/gsap.js'
import reveal, { PRESETS } from './reveal/index.js'
import splitText from './split-text/index.js'
import marquee, { copiesNeeded } from './marquee/index.js'
import slider, { nearestIndex } from './slider/index.js'
import counter, { formatNumber, parseNumber } from './counter/index.js'
import parallax from './parallax/index.js'
import magnetic, { magneticShift } from './magnetic/index.js'
import stickyHeader, { nextHidden } from './sticky-header/index.js'
import scrollTop from './scroll-top/index.js'
import lazyVideo from './lazy-video/index.js'
import { kitModules } from './index.js'
import { isLazy } from '../core/registry.js'
import { lockScroll, resetScrollLock } from '../core/scroll-lock.js'
import { createCtx, html, setSize, tick } from '../../../test/helpers.js'

const motion = (extra) => createCtx({ reduced: false, ...extra })

describe('reveal', () => {
  it('ставит is-revealed и начальное состояние, destroy всё убирает', () => {
    const root = html('<section><h2 data-reveal>a</h2><p data-reveal="fade">b</p></section>')
    const batch = vi.spyOn(ScrollTrigger, 'batch')
    const api = reveal(root, motion())
    const h2 = root.querySelector('h2')
    expect(h2.classList.contains('is-revealed')).toBe(true)
    expect(gsap.getProperty(h2, 'opacity')).toBe(0)
    expect(gsap.getProperty(h2, 'y')).toBe(PRESETS.up.y)
    expect(batch.mock.calls[0][0]).toHaveLength(2)
    api.destroy()
    expect(h2.classList.contains('is-revealed')).toBe(false)
    expect(h2.style.opacity).toBe('')
  })

  it('видимое при загрузке показывает сразу, а не ждёт прокрутки', () => {
    // Регрессия: элемент внизу первого экрана (ниже линии 'top 85%') оставался
    // невидимым до прокрутки.
    const root = html('<section><p data-reveal>низ экрана</p><p data-reveal>ниже</p></section>')
    const [first, second] = root.querySelectorAll('p')
    vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({ top: window.innerHeight - 40, bottom: window.innerHeight, height: 40 })
    const batch = vi.spyOn(ScrollTrigger, 'batch')
    const to = vi.spyOn(gsap, 'to')
    const api = reveal(root, motion())
    expect(to.mock.calls[0][0]).toEqual([first])
    expect(batch.mock.lastCall[0]).toEqual([second])
    api.destroy()
  })

  it('reduced motion — просто показывает; неизвестный пресет — предупреждение', () => {
    const root = html('<section><h2 data-reveal>a</h2></section>')
    expect(reveal(root, createCtx())).toBeUndefined()
    expect(root.querySelector('h2').classList.contains('is-revealed')).toBe(true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    reveal(html('<div data-reveal="spin"></div>'), motion()).destroy()
    expect(warn.mock.calls[0][0]).toContain('spin')
  })
})

describe('split-text', () => {
  it('разбивает на строки и возвращает текст при destroy', () => {
    const el = html('<h2>Привет мир</h2>')
    const api = splitText(el, motion({ options: { type: 'words' } }))
    expect(el.querySelectorAll('.split-word').length).toBe(2)
    api.destroy()
    expect(el.innerHTML).toBe('Привет мир')
  })

  it('reduced — без разбивки; неверный type — ошибка', () => {
    const el = html('<h2>Текст</h2>')
    splitText(el, createCtx())
    expect(el.querySelector('.split-word')).toBeNull()
    expect(() => splitText(el, motion({ options: { type: 'letters' } }))).toThrow(/lines, words или chars/)
  })
})

describe('marquee', () => {
  it('copiesNeeded покрывает экран с запасом', () => {
    expect(copiesNeeded(300, 1000)).toBe(5)
    expect(copiesNeeded(0, 1000)).toBe(1)
  })

  it('клонирует содержимое (aria-hidden, inert), едет и убирает клоны', () => {
    const root = setSize(html('<div><div data-marquee-track><span>a</span><span>b</span></div></div>'), { width: 400 })
    const track = root.querySelector('[data-marquee-track]')
    // jsdom не считает offsetLeft — подставим: каждый элемент 100px.
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
      configurable: true,
      get() {
        return Array.from(this.parentNode?.children ?? []).indexOf(this) * 100
      },
    })
    const api = marquee(root, motion())
    const clones = track.querySelectorAll('[aria-hidden="true"]')
    expect(clones.length).toBe(copiesNeeded(200, 400) * 2)
    expect(clones[0].inert).toBe(true)
    triggerIntersect(root, true)
    gsap.ticker.tick()
    api.destroy()
    expect(track.children.length).toBe(2)
    expect(track.style.transform).toBe('')
    delete HTMLElement.prototype.offsetLeft
  })

  it('reduced — ничего не делает; без track — ошибка', () => {
    const root = html('<div><div data-marquee-track><span>a</span></div></div>')
    expect(marquee(root, createCtx())).toBeUndefined()
    expect(() => marquee(html('<div></div>'), motion())).toThrow(/data-marquee-track/)
  })
})

describe('slider', () => {
  it('nearestIndex', () => {
    expect(nearestIndex([0, 300, 600], 280)).toBe(1)
    expect(nearestIndex([0, 300, 600], 0)).toBe(0)
  })

  it('точки, aria, стрелки и автопрокрутка с паузой', async () => {
    vi.useFakeTimers()
    const root = html(`<div><div data-slider-track><div>1</div><div>2</div><div>3</div></div>
      <button data-slider-prev></button><button data-slider-next></button><div data-slider-dots></div></div>`)
    const track = root.querySelector('[data-slider-track]')
    const scrollTo = vi.fn()
    track.scrollTo = scrollTo
    const api = slider(root, motion({ options: { autoplay: 1000 } }))
    expect(root.querySelectorAll('.slider__dot')).toHaveLength(3)
    expect(track.children[0].getAttribute('aria-label')).toBe('1 из 3')
    root.querySelector('[data-slider-next]').click()
    expect(scrollTo).toHaveBeenCalled()
    triggerIntersect(root, true)
    vi.advanceTimersByTime(1000)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    root.dispatchEvent(new Event('pointerenter'))
    vi.advanceTimersByTime(3000)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    api.destroy()
    expect(root.querySelectorAll('.slider__dot')).toHaveLength(0)
    vi.useRealTimers()
  })

  it('перетаскивание мышью гасит клик по ссылке', () => {
    const root = html('<div><div data-slider-track><a href="#x">1</a><div>2</div></div></div>')
    const track = root.querySelector('[data-slider-track]')
    track.scrollTo = () => {}
    slider(root, motion())
    track.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', button: 0, clientX: 100 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 40 }))
    expect(root.classList.contains('is-dragging')).toBe(true)
    window.dispatchEvent(new PointerEvent('pointerup'))
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    track.querySelector('a').dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
  })
})

describe('counter', () => {
  it('parseNumber и formatNumber', () => {
    expect(parseNumber('1 500,5 ₽')).toBe(1500.5)
    expect(formatNumber(1500, { suffix: '+' })).toBe('1\u00a0500+')
    expect(formatNumber(98.5, { decimals: 1 })).toBe('98,5')
  })

  it('считает при появлении, destroy возвращает итог', () => {
    const el = html('<span>1 500</span>')
    const api = counter(el, motion())
    expect(el.textContent).toBe('0')
    expect(el.getAttribute('aria-label')).toBe('1\u00a0500')
    triggerIntersect(el, true)
    api.destroy()
    expect(el.textContent).toBe('1\u00a0500')
  })

  it('reduced — сразу итог; не число — предупреждение', () => {
    const el = html('<span data-counter-to="42">x</span>')
    counter(el, createCtx())
    expect(el.textContent).toBe('42')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    counter(html('<span>много</span>'), motion())
    expect(warn).toHaveBeenCalled()
  })
})

describe('parallax и magnetic', () => {
  it('parallax создаёт scrub-триггер и запас для картинки', () => {
    const el = html('<div data-parallax-speed="0.2"><img alt=""></div>')
    const api = parallax(el, motion())
    expect(el.querySelector('img').style.height).toBe('140%')
    api.destroy()
    expect(el.querySelector('img').style.height).toBe('')
    expect(parallax(el, createCtx())).toBeUndefined()
  })

  it('magnetic работает только с мышью', () => {
    const el = html('<a>btn</a>')
    expect(magnetic(el, motion())).toBeUndefined()
    setMedia({ '(hover: hover) and (pointer: fine)': true })
    const api = magnetic(el, motion())
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 0 }))
    api.destroy()
    expect(el.style.transform).toBe('')
  })

  it('magneticShift: центр считается без текущего сдвига (кнопка не «уплывает»)', () => {
    const rect = { left: 110, top: 0, width: 100, height: 40 } // кнопка уже сдвинута на 10px
    // Без сдвига кнопка занимает 100…200, центр — 150.
    expect(magneticShift(rect, { x: 10, y: 0 }, { x: 150, y: 20 }, 0.5)).toEqual({ x: 0, y: 0 })
    expect(magneticShift(rect, { x: 10, y: 0 }, { x: 190, y: 20 }, 0.5)).toEqual({ x: 20, y: 0 })
  })

  it('magnetic: тянется и при втором, и при третьем наведении (баг «только в первый раз»)', async () => {
    setMedia({ '(hover: hover) and (pointer: fine)': true })
    const el = html('<a>btn</a>')
    setSize(el, { width: 100, height: 40 })
    const api = magnetic(el, motion())
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const hoverAndLeaveQuickly = async () => {
      // Живая мышь уходит, пока кнопка ещё едет за ней, — именно это убивало эффект.
      el.dispatchEvent(new PointerEvent('pointerenter'))
      el.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 20 }))
      await wait(60)
      el.dispatchEvent(new PointerEvent('pointerleave'))
      await wait(100)
    }
    for (let round = 1; round <= 3; round++) {
      await hoverAndLeaveQuickly()
      el.dispatchEvent(new PointerEvent('pointerenter'))
      el.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 20 }))
      await wait(500)
      expect(Number(gsap.getProperty(el, 'x')), `наведение №${round}`).toBeGreaterThan(5)
      el.dispatchEvent(new PointerEvent('pointerleave'))
      await wait(800)
      expect(Math.abs(Number(gsap.getProperty(el, 'x'))), `возврат №${round}`).toBeLessThan(1)
    }
    api.destroy()
  })
})

describe('sticky-header', () => {
  it('nextHidden: у верха показана, вниз — спрятана, мелкие сдвиги игнорируются', () => {
    const base = { offset: 80, tolerance: 8, hidden: false }
    expect(nextHidden({ ...base, y: 50, lastY: 0 })).toBe(false)
    expect(nextHidden({ ...base, y: 300, lastY: 200 })).toBe(true)
    expect(nextHidden({ ...base, y: 200, lastY: 300, hidden: true })).toBe(false)
    expect(nextHidden({ ...base, y: 303, lastY: 300, hidden: true })).toBe(true)
  })

  it('пишет --header-height и не прячется при заблокированной прокрутке', async () => {
    const el = setSize(html('<header></header>'), { height: 72 })
    const api = stickyHeader(el, motion())
    expect(document.documentElement.style.getPropertyValue('--header-height')).toBe('72px')
    resetScrollLock()
    lockScroll()
    window.scrollY = 500
    window.dispatchEvent(new Event('scroll'))
    await tick(20)
    expect(el.classList.contains('is-scrolled')).toBe(true)
    expect(el.classList.contains('is-hidden')).toBe(false)
    resetScrollLock()
    api.destroy()
    window.scrollY = 0
  })
})

describe('scroll-top и lazy-video', () => {
  it('scroll-top прокручивает через ctx.scroll', () => {
    const button = html('<button></button>')
    const scroll = { scrollTo: vi.fn() }
    scrollTop(button, motion({ scroll }))
    button.click()
    expect(scroll.scrollTo).toHaveBeenCalledWith(0, { offset: 0 })
  })

  it('lazy-video: muted+playsinline, src только перед показом, ошибки play() глушатся', async () => {
    const video = html('<video data-src="/v.mp4"></video>')
    video.load = vi.fn()
    video.play = vi.fn(() => Promise.reject(new Error('NotAllowed')))
    video.pause = vi.fn()
    const api = lazyVideo(video, motion())
    expect(video.muted).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
    expect(video.getAttribute('src')).toBeNull()
    triggerIntersect(video, true)
    await tick()
    expect(video.getAttribute('src')).toBe('/v.mp4')
    expect(video.play).toHaveBeenCalled()
    triggerIntersect(video, false)
    expect(video.pause).toHaveBeenCalled()
    api.destroy()
    expect(() => lazyVideo(html('<div></div>'))).toThrow(/<video>/)
  })
})

describe('kitModules', () => {
  it('все ленивые модули загружаются и экспортируют функцию', async () => {
    for (const [name, init] of Object.entries(kitModules)) {
      expect(typeof init, name).toBe('function')
    }
    const names = Object.keys(kitModules).filter((n) => isLazy(kitModules[n]))
    expect(names.length).toBeGreaterThan(5)
    // Каждый ленивый модуль должен реально грузиться (ловит опечатки в путях import()).
    for (const name of names) {
      const el = html(`<div data-module="${name}"></div>`)
      await kitModules[name](el, createCtx()).catch(() => {})
    }
  })
})
