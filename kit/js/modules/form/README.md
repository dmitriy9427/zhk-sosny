# form

Проверка (схема или HTML), режимы как в RHF, маски, отправка, ошибки сервера.

|                 |                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Подключение     | `data-module="form"`                                                                            |
| Настройки       | ajax, mode, schema, resetOnSuccess, success, failure, invalid (+ onSubmit из JS)                |
| API (экземпляр) | getValues(), validate(), validateField(), setErrors(), clearErrors(), errors, reset(), submit() |
| События         | form:invalid, form:submit, form:success, form:error                                             |

**Что учтено:** Двойная отправка, reset, связанные поля, ошибки сервера держатся, minlength у автозаполнения. Подробно — docs/forms.md.

Разметка и примеры — [docs/modules.md](../../../../docs/modules.md#form),
подробности и «почему так» — комментарий в начале `index.js`.
