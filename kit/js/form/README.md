# js/form — формы

| Файл        | Что делает                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `schema.js` | `s.string() / number() / boolean() / date() / enum() / array() / files() / object()` — проверка в стиле zod, русские тексты, ИНН/СНИЛС |
| `mask.js`   | маски: phone, date, time, inn, snils, postcode, passport, number, свой шаблон; `attachMask`                                            |
| `values.js` | `formValues(form)` — значения формы объектом (чекбоксы, группы, файлы)                                                                 |
| `index.js`  | всё вместе + `registerSchema(name, schema)` для `data-form-schema`                                                                     |

Руководство — [docs/forms.md](../../../docs/forms.md). Тесты — `form-lib.test.js`.
