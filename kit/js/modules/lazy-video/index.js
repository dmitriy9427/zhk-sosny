/**
 * Фоновое видео: грузится, когда подъезжает к экрану, играет только видимым.
 *
 *   <video data-module="lazy-video" data-src="/video/hero.mp4"
 *          poster="/video/hero.jpg" muted loop playsinline preload="none"></video>
 *
 * ─── Баги, закрытые здесь ───────────────────────────────────────────────────
 * 1. Видео не запускается автоматически на iOS/Chrome: автозапуск разрешён
 *    только БЕЗ звука и (на iOS) с playsinline. Модуль выставляет оба свойства
 *    сам — даже если в разметке забыли.
 * 2. play() возвращает Promise, который отклоняется (экономия энергии,
 *    вкладка в фоне) — «Uncaught (in promise) DOMException» в консоли.
 *    Ловим и молча оставляем постер.
 * 3. Десять видео на странице грузятся сразу и съедают трафик мобилки.
 *    src подставляется только перед появлением на экране.
 * 4. Пользователь просил меньше движения — не запускаем, показываем постер.
 * @module kit/modules/lazy-video
 */
import { createDisposer, onViewport } from '../../core/lifecycle.js'

export default function lazyVideo(video, ctx = {}) {
  if (video.tagName !== 'VIDEO') throw new Error('[kit] lazy-video: модуль ставится на <video>')
  const d = createDisposer()
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')

  let loaded = false
  const load = () => {
    if (loaded) return
    loaded = true
    if (video.dataset.src) video.src = video.dataset.src
    video.querySelectorAll('source[data-src]').forEach((s) => (s.src = s.dataset.src))
    video.load()
  }

  const play = () => {
    if (ctx.reduced) return
    load()
    video.play()?.catch(() => {})
  }

  // Загружаем заранее (за 300px), играем — только когда видно.
  d.add(onViewport(video, { enter: load, rootMargin: '300px' }))
  d.add(onViewport(video, { enter: play, leave: () => video.pause() }))
  d.add(() => video.pause())

  return { play, pause: () => video.pause(), destroy: d.dispose }
}
