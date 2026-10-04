/**
 * Шина событий: модули общаются, не импортируя друг друга.
 *
 *   ctx.bus.emit('cart:add', { id: 5 })            // «случилось»
 *   const off = ctx.bus.on('cart:add', (item) => …) // «если случится — сделаю»
 *   d.add(off)                                      // не забыть отписаться!
 *
 * replay: подписчик с { replay: true } сразу получает последнее значение —
 * для модулей, которые запустились позже, чем событие произошло.
 *
 * Именуйте события «область:что» ('dialog:open', 'menu:toggle') и ведите их
 * список в README проекта — иначе через месяц никто не вспомнит, кто что шлёт.
 * @module kit/core/bus
 */

export function createBus() {
  const handlers = new Map()
  const last = new Map()

  return {
    on(event, fn, { replay = false } = {}) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event).add(fn)
      if (replay && last.has(event)) fn(last.get(event))
      return () => handlers.get(event)?.delete(fn)
    },
    /** Подписаться на одно срабатывание. */
    once(event, fn) {
      const off = this.on(event, (payload) => {
        off()
        fn(payload)
      })
      return off
    },
    emit(event, payload) {
      last.set(event, payload)
      // Копия набора: если обработчик отпишется во время рассылки, остальные всё равно получат событие.
      Array.from(handlers.get(event) ?? []).forEach((fn) => {
        try {
          fn(payload)
        } catch (error) {
          console.error(`[kit] bus «${event}»`, error)
        }
      })
    },
    last: (event) => last.get(event),
    clear() {
      handlers.clear()
      last.clear()
    },
  }
}
