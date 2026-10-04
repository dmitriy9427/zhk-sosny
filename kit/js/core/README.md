# js/core — ядро

| Файл                                 | Что делает                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `app.js`                             | `createApp({ modules })` — запуск всего: контекст, плавный скролл, модули, пересчёт ScrollTrigger |
| `registry.js`                        | `mount/unmount/observe/lazy/getInstance` — запуск модулей по `data-module`, без двойного запуска  |
| `lifecycle.js`                       | `createDisposer()` — «уборка за собой», `onViewport()` — элемент на экране                        |
| `bus.js`                             | `createBus()` — шина событий между модулями (с replay)                                            |
| `options.js`                         | `readOptions(el, name, DEFAULTS)` — настройки из `data-*` с приведением типов                     |
| `env.js`                             | брейкпоинты из CSS, reduced motion, hover, тач, `watchMedia`                                      |
| `dom.js`                             | `qs/qsa`, `focusable`, `trapFocus`, `delegate`, `ownElements`, `ensureId`                         |
| `scroll-lock.js`                     | блокировка прокрутки со счётчиком и компенсацией полосы прокрутки                                 |
| `smooth-scroll.js`                   | Lenis + ScrollTrigger + якоря с учётом шапки                                                      |
| `url.js`                             | состояние в адресе: `getParam/setParam`, `getHash/setHash`                                        |
| `gsap.js`                            | GSAP + ScrollTrigger с настройками против «прыжков» на мобилке                                    |
| `math.js`, `timing.js`, `storage.js` | clamp/lerp/damp/wrap; debounce/throttle/rafThrottle; безопасный localStorage                      |

Импортируйте конкретные файлы (`kit/js/core/lifecycle.js`), а не `index.js`, — в сборку попадёт
только нужное. Тесты: `core.test.js`, `registry.test.js`.
