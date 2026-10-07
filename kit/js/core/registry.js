/**
 * Реестр модулей: находит в разметке `data-module="имя"` и запускает код модуля.
 *
 * ─── Зачем ──────────────────────────────────────────────────────────────────
 * HTML сам говорит, какие компоненты на странице есть. Добавили на страницу
 * `<div data-module="accordion">` — аккордеон заработал. Удалили блок — его
 * код не запустится и ничего не сломает. Не нужно в main.js помнить, на какой
 * странице какой компонент.
 *
 * ─── Контракт модуля ─────────────────────────────────────────────────────────
 *   export default function init(element, ctx) {
 *     …включили обработчики/анимации…
 *     return { destroy() { …выключили… } }   // или ничего, если убирать нечего
 *   }
 * Можно вернуть Promise (асинхронный модуль, например грузит three.js).
 *
 * ─── Что предусмотрено (частые баги) ───────────────────────────────────────
 * 1. Двойной запуск. Если вызвать mount дважды на одном и том же блоке
 *    (после htmx-подгрузки, повторной инициализации), модуль НЕ запустится
 *    второй раз: экземпляры хранятся в WeakMap «элемент → модули».
 *    Без этого — двойные обработчики, аккордеон открывается и сразу закрывается.
 * 2. Несколько модулей на одном элементе: `data-module="reveal magnetic"`.
 * 3. Ошибка одного модуля не ломает остальные: пишется в консоль, остальные
 *    запускаются.
 * 4. Опечатка в имени: предупреждение в консоли со списком доступных имён.
 * 5. Ленивые модули: `lazy(() => import('./heavy'))` — код скачивается, только
 *    если на странице есть такой блок.
 * @module kit/core/registry
 */

/** Элемент → Map(имя → экземпляр). WeakMap: удалённый из DOM элемент соберёт сборщик мусора. */
const instances = new WeakMap()

/** Метка ленивого модуля. */
const LAZY = Symbol('lazy')
/** Модуль на элементе ещё запускается (ленивый грузится). */
const PENDING = Symbol('pending')

/**
 * Обернуть загрузчик модуля, чтобы код скачивался только при необходимости.
 *   registry = { gallery: lazy(() => import('./modules/gallery')) }
 * Загруженный файл должен экспортировать `default` или `init`.
 * @param {() => Promise<any>} loader
 */
export function lazy(loader) {
  let promise = null
  const load = () => {
    // Кешируем: десять галерей на странице → один сетевой запрос.
    promise ??= loader().then((mod) => mod.default ?? mod.init ?? mod)
    return promise
  }
  return Object.assign(async (el, ctx) => (await load())(el, ctx), { [LAZY]: true })
}

/** Это ленивый модуль? (для devtools и тестов) */
export const isLazy = (init) => Boolean(init?.[LAZY])

/** Имена модулей элемента: "reveal  magnetic" → ['reveal', 'magnetic']. */
export const moduleNames = (el) => (el.dataset.module ?? '').trim().split(/\s+/).filter(Boolean)

/**
 * Все элементы с data-module внутри root, включая сам root.
 * Включаем root, потому что при подгрузке фрагмента (htmx, fetch) новым
 * узлом часто оказывается сам блок с data-module.
 */
function collect(root) {
  const list = Array.from(root.querySelectorAll?.('[data-module]') ?? [])
  if (root.nodeType === 1 && root.hasAttribute('data-module')) list.unshift(root)
  return list
}

/**
 * Запустить модули внутри root.
 *
 * @param {Record<string, Function>} registry Имя → init (или lazy(...)).
 * @param {object} [ctx] Общий контекст для всех модулей (bus, scroll, …).
 * @param {ParentNode} [root=document]
 * @param {{ strict?: boolean }} [options] strict:false — молча пропускать
 *   неизвестные имена (нужно, если на странице есть модули другого реестра).
 * @returns {Promise<{ mounted: string[], failed: string[] }>}
 */
export async function mount(registry, ctx = {}, root = document, { strict = true } = {}) {
  const mounted = []
  const failed = []
  const jobs = []

  for (const el of collect(root)) {
    if (!instances.has(el)) instances.set(el, new Map())
    const own = instances.get(el)

    for (const name of moduleNames(el)) {
      if (own.has(name)) continue // уже запущен — второй раз не надо (баг №1)

      const init = registry[name]
      if (!init) {
        if (strict) {
          console.warn(`[kit] нет модуля «${name}». Доступны: ${Object.keys(registry).join(', ') || '—'}`, el)
          failed.push(name)
        }
        continue
      }

      // Ставим «заглушку» сразу, до await: если mount вызовут ещё раз, пока
      // ленивый модуль грузится, второй запуск увидит, что место занято.
      own.set(name, PENDING)
      jobs.push(
        (async () => {
          try {
            const instance = await init(el, ctx)
            // Пока грузились, элемент могли размонтировать — тогда сразу убираем.
            if (!instances.get(el)?.has(name)) return instance?.destroy?.()
            own.set(name, instance ?? null)
            mounted.push(name)
            notify(el, name)
          } catch (error) {
            own.delete(name)
            failed.push(name)
            console.error(`[kit] модуль «${name}» упал при запуске`, el, error)
          }
        })(),
      )
    }
  }

  await Promise.all(jobs)
  return { mounted, failed }
}

/**
 * Остановить модули внутри root (вызвать destroy в обратном порядке).
 * Вызывайте ПЕРЕД удалением блока из DOM или заменой его содержимого.
 * @param {ParentNode} [root=document]
 */
export function unmount(root = document) {
  const elements = collect(root).reverse()
  for (const el of elements) {
    const own = instances.get(el)
    if (!own) continue
    for (const [name, instance] of Array.from(own).reverse()) {
      try {
        if (instance !== PENDING) instance?.destroy?.()
      } catch (error) {
        console.error(`[kit] ошибка destroy у «${name}»`, error)
      }
    }
    instances.delete(el)
  }
}

/**
 * Экземпляр модуля на элементе — чтобы управлять им снаружи:
 *   getInstance(el, 'dialog').open()
 * @returns {object | null | undefined}
 */
export function getInstance(el, name) {
  const instance = instances.get(el)?.get(name)
  return instance === PENDING ? undefined : instance
}

/** Запущен ли модуль name на элементе (экземпляр может быть null — модуль без API). */
export const isMounted = (el, name) => Boolean(instances.get(el)?.has(name)) && instances.get(el).get(name) !== PENDING

/** Имена запущенных на элементе модулей. */
export const mountedNames = (el) =>
  Array.from(instances.get(el) ?? []).flatMap(([name, instance]) => (instance === PENDING ? [] : [name]))

// ─── Ожидание запуска ────────────────────────────────────────────────────────
// Модули запускаются асинхронно (ленивые грузятся по сети) и в произвольном
// порядке. Модулю A, которому нужен модуль B, нельзя просто взять экземпляр
// при старте — B может быть ещё не загружен. whenMounted ждёт.

/** @type {Set<{ match: (el: Element, name: string) => boolean, done: (el: Element, name: string) => void }>} */
const waiters = new Set()

function notify(el, name) {
  for (const waiter of Array.from(waiters)) if (waiter.match(el, name)) waiter.done(el, name)
}

/**
 * Дождаться запуска модуля, подходящего под условие.
 * @param {(el: Element, name: string) => boolean} match
 * @param {{ timeout?: number, signal?: AbortSignal, label?: string }} [o]
 * @returns {Promise<{ el: Element, name: string }>}
 */
export function waitMounted(match, { timeout = 10000, signal, label = 'модуль' } = {}) {
  return new Promise((resolve, reject) => {
    const waiter = {
      match,
      done: (el, name) => {
        cleanup()
        resolve({ el, name })
      },
    }
    const timer =
      timeout > 0
        ? setTimeout(() => {
            cleanup()
            reject(new Error(`[kit] не дождались запуска: ${label} (${timeout} мс). Есть ли он на странице?`))
          }, timeout)
        : null
    const onAbort = () => {
      cleanup()
      reject(signal.reason ?? new Error('aborted'))
    }
    function cleanup() {
      waiters.delete(waiter)
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    signal?.addEventListener('abort', onAbort)
    waiters.add(waiter)
  })
}

/**
 * Следить за DOM и запускать/останавливать модули у добавленных/удалённых
 * блоков автоматически. Нужно, если контент подгружается без перезагрузки
 * страницы (htmx, «Показать ещё», вставка из CMS).
 * @returns {() => void} Отключить наблюдение.
 */
export function observe(registry, ctx = {}, root = document.body, options) {
  if (typeof MutationObserver === 'undefined') return () => {}

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.removedNodes.forEach((node) => {
        // Узел могли просто переставить (appendChild существующего) — тогда он
        // всё ещё в документе, останавливать нельзя.
        if (node instanceof Element && !node.isConnected) unmount(node)
      })
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) mount(registry, ctx, node, options)
      })
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  return () => observer.disconnect()
}
