# select

Кастомный селект поверх настоящего <select>: поиск, несколько значений (чипсы), группы, подгрузка вариантов.

|                 |                                                                   |
| --------------- | ----------------------------------------------------------------- |
| Подключение     | `data-module="select"`                                            |
| Настройки       | search, placeholder, max, clearable, closeOnSelect (+ load из JS) |
| API (экземпляр) | value, setValue(v), open(), close(), refresh(), clear()           |
| События         | change/input на настоящем select                                  |

**Что учтено:** Список в верхнем слое (не обрезается модалкой); открытие вверх у края; ё = е; reset формы; ошибки формы переносятся на видимое поле; ARIA combobox + listbox.

Разметка и примеры — [docs/modules.md](../../../../docs/modules.md#select),
подробности и «почему так» — комментарий в начале `index.js`. Живой пример — `starters/vanilla/effects.html`.
