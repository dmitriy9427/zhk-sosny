# infinite-slider

Бесконечная лента: DOM или 3D-барабан на WebGL (three.js лениво).

|                 |                                                       |
| --------------- | ----------------------------------------------------- |
| Подключение     | `data-module="infinite-slider"`                       |
| Настройки       | mode, skew, parallax, curve, reflection, snap, bounce |
| API (экземпляр) | engine, next(), prev(), goTo(i), index                |
| События         | infinite-slider:change                                |

**Что учтено:** Вертикальный свайп отдаётся странице; горизонтальное колесо; клик после перетаскивания; без WebGL — DOM.

Разметка и примеры — [docs/modules.md](../../../../docs/modules.md#infinite-slider),
подробности и «почему так» — комментарий в начале `index.js`. Живой пример — `starters/vanilla/effects.html`.
