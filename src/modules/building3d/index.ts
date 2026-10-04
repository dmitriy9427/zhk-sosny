/**
 * Модуль 3D-квартала на первом экране.
 *
 *   <div class="building3d" data-module="building3d" data-towers='[{"tower":1,"free":52},…]'>
 *     <p class="building3d__tooltip" hidden></p>
 *   </div>
 *
 * three.js (≈ 600 КБ) грузится ЛЕНИВО — после того как страница показана,
 * а без WebGL или при «меньше движения» остаётся CSS-картинка-заглушка.
 * Кадры — только пока блок виден. Наведение на башню — подсказка с числом
 * свободных квартир, клик — /flats/?tower=N.
 */
import { gsap, ScrollTrigger } from 'kit/js/core/gsap.js'
import { createDisposer, onViewport } from 'kit/js/core/lifecycle.js'
import { supportsWebGL } from 'kit/js/core/webgl.js'
import type { TowerInfo } from './scene'

export default async function building3d(el: HTMLElement, ctx: { reduced?: boolean } = {}) {
  if (!supportsWebGL()) return undefined
  const d = createDisposer()
  const towers: TowerInfo[] = JSON.parse(el.dataset.towers ?? '[]')
  const tooltip = el.querySelector<HTMLElement>('.building3d__tooltip')
  const { createScene } = await import('./scene')
  if (d.disposed) return undefined

  const scene = createScene(el, towers, Math.min(window.devicePixelRatio || 1, 1.75))
  d.add(() => scene.dispose())
  el.classList.add('is-ready')

  const ro = new ResizeObserver(() => scene.resize(el.clientWidth, el.clientHeight))
  ro.observe(el)
  d.add(() => ro.disconnect())
  scene.resize(el.clientWidth, el.clientHeight)

  // Прокрутка первого экрана — камера облетает и поднимается.
  let progress = 0
  const trigger = ScrollTrigger.create({
    trigger: el,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => (progress = self.progress),
  })
  d.add(() => trigger.kill())

  // Мышь — лёгкий параллакс (с инерцией).
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  d.listen(el, 'pointermove', (event: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    mouse.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1
    const info = scene.pick(event.clientX, event.clientY)
    el.style.cursor = info ? 'pointer' : ''
    if (tooltip) {
      tooltip.hidden = !info
      if (info) {
        tooltip.textContent = `Башня ${info.tower} · свободно ${info.free}`
        tooltip.style.transform = `translate(${event.clientX - rect.left + 16}px, ${event.clientY - rect.top + 16}px)`
      }
    }
  })
  d.listen(el, 'pointerleave', () => {
    if (tooltip) tooltip.hidden = true
    mouse.tx = mouse.ty = 0
  })
  d.listen(el, 'click', (event: MouseEvent) => {
    const info = scene.pick(event.clientX, event.clientY)
    if (info) location.href = `/flats/?tower=${info.tower}`
  })

  let time = 0
  const tick = (_t: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, 0.05)
    if (!ctx.reduced) time += dt
    const k = 1 - Math.exp(-dt * 3)
    mouse.x += (mouse.tx - mouse.x) * k
    mouse.y += (mouse.ty - mouse.y) * k
    scene.render(time, progress, mouse.x, mouse.y)
  }
  let running = false
  d.add(
    onViewport(el, {
      enter: () => {
        if (!running) gsap.ticker.add(tick)
        running = true
      },
      leave: () => {
        gsap.ticker.remove(tick)
        running = false
      },
    }),
  )
  d.add(() => gsap.ticker.remove(tick))
  return { destroy: d.dispose }
}
