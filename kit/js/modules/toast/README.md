# toast

Уведомления: toast() из JS или кнопки data-toast.

|                 |                                            |
| --------------- | ------------------------------------------ |
| Подключение     | `data-module="toast"`                      |
| Настройки       | data-toast, data-toast-type                |
| API (экземпляр) | toast(msg, { type, duration }) → { close } |
| События         | —                                          |

**Что учтено:** aria-live; не исчезает под мышью/фокусом; textContent (без XSS).

Разметка и примеры — [docs/modules.md](../../../../docs/modules.md#toast),
подробности и «почему так» — комментарий в начале `index.js`.
