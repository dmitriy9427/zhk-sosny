# accordion

Раскрывающиеся блоки (FAQ).

|                 |                                         |
| --------------- | --------------------------------------- |
| Подключение     | `data-module="accordion"`               |
| Настройки       | multiple, hash                          |
| API (экземпляр) | open(i), close(i), toggle(i), isOpen(i) |
| События         | accordion:toggle                        |

**Что учтено:** Высота анимируется CSS-гридом (0fr→1fr) — без замеров; закрытые панели inert; ↑/↓/Home/End.

Разметка и примеры — [docs/modules.md](../../../../docs/modules.md#accordion),
подробности и «почему так» — комментарий в начале `index.js`.
