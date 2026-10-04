# infinite-gallery

Бесконечная сетка фото: тянуть мышью/пальцем, колесо, скролл, дрейф, лайтбокс.

|                 |                                                                                 |
| --------------- | ------------------------------------------------------------------------------- |
| Подключение     | `data-module="infinite-gallery"`                                                |
| Настройки       | lag, dragSpeed, columnStep, scrollFollow, drift, tilt, pin, pinLength, lightbox |
| API (экземпляр) | moveBy(x, y), open(i), lightbox                                                 |
| События         | —                                                                               |

**Что учтено:** Подсказка о дырах в сетке; клик после перетаскивания; призрачная копия картинки; пауза дрейфа под мышью.

Разметка и примеры — [docs/modules.md](../../../../docs/modules.md#infinite-gallery),
подробности и «почему так» — комментарий в начале `index.js`. Живой пример — `starters/vanilla/effects.html`.
