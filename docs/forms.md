# Формы

Модуль `form` + библиотека `kit/js/form`: проверка как в **react-hook-form + zod**, маски,
поля (файлы, пароль, счётчик, степпер), отправка без перезагрузки, ошибки с сервера под полями.

## Минимальная форма

```html
<form data-module="form" data-form-ajax data-form-schema="callback" action="/api/callback" method="post" novalidate>
  <label class="field">
    <span class="field__label">Имя</span>
    <input class="field__input" name="name" autocomplete="name" />
  </label>
  <label class="field">
    <span class="field__label">Телефон</span>
    <input class="field__input" name="phone" type="tel" data-mask="phone" autocomplete="tel" />
  </label>
  <include src="consent.html"></include>
  <button class="btn" type="submit">Отправить</button>
  <p data-form-status role="status"></p>
</form>
```

```js
// src/forms/schemas.js (подключён в main.js до запуска модулей)
import { registerSchema, s } from 'kit/js/form/index.js'

registerSchema(
  'callback',
  s.object({
    name: s.string().trim().min(2),
    phone: s.string().phone(),
    consent: s.boolean().isTrue('Нужно ваше согласие'),
  }),
)
```

Ошибка появляется под полем: модуль сам создаёт `<p class="field__error">` в ближайшем
`[data-field]` или `.field` (для группы чекбоксов/радио — в `<fieldset>`). Своё место для
ошибки — элемент `[data-form-error]` внутри поля.

## Схемы (как zod)

| Схема              | Методы                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `s.string()`       | `.trim() .min(n) .max(n) .length(n) .email() .url() .phone() .inn() .snils() .regex(re, msg) .equals('поле', msg)` |
| `s.number()`       | `.min(n) .max(n) .int() .positive()` — строка «1 500,5» приводится к 1500.5                                        |
| `s.boolean()`      | `.isTrue(msg)` — для согласия                                                                                      |
| `s.date()`         | `.min(дата) .max(дата) .minAge(лет)` — «ДД.ММ.ГГГГ» и «ГГГГ-ММ-ДД», `'today'`                                      |
| `s.enum([…], msg)` | радио, select                                                                                                      |
| `s.array(item?)`   | `.min(n) .max(n)` — группа чекбоксов (`name="services[]"`), select multiple                                        |
| `s.files()`        | `.min(n) .max(n) .maxSize(байт) .accept(['image/*', '.pdf'])`                                                      |
| `s.object({…})`    | `.refine(fn, { path, message }) .omit([…]) .extend({…}) .safeParse() .parse()`                                     |

Общее для всех: `.optional()`, `.default(v)`, `.required(msg)`, `.refine(fn, msg)`, `.transform(fn)`.
Все тексты ошибок по умолчанию — по-русски, со склонениями («Минимум 2 символа», «5 символов»).
Каждый метод возвращает новую схему: `const phone = s.string().phone()` можно переиспользовать.

```js
const schema = s
  .object({
    password: s.string().min(8).regex(/\d/, 'Нужна цифра'),
    confirm: s.string().equals('password', 'Пароли не совпадают'),
    from: s.date(),
    to: s.date(),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, { path: 'to', message: 'Дата «по» раньше даты «с»' })

schema.safeParse(values) // { success, data, errors: { поле: 'текст' } }
```

**Уже есть zod?** Модуль примет zod-схему как есть (нужен метод `safeParse`):
`registerSchema('callback', z.object({…}))`.

**Без схемы** правила берутся из HTML: `required`, `type="email"`, `minlength`, `maxlength`,
`pattern`, `min`, `max`. Тексты — русские; свои — `data-error-required`, `data-error-type`,
`data-error-pattern`, `data-error-length`, `data-error-range`, `data-error-mask`.
Поля, которых нет в схеме, тоже проверяются по HTML.

## Когда показывать ошибки (mode)

`data-form-mode`:

| mode                       | Поведение                                              |
| -------------------------- | ------------------------------------------------------ |
| `onTouched` (по умолчанию) | первый раз — при уходе с поля, дальше — на каждый ввод |
| `onBlur`                   | при уходе с поля                                       |
| `onChange`                 | на каждый ввод (агрессивно — для коротких форм)        |
| `onSubmit`                 | только при отправке                                    |
| `all`                      | и при вводе, и при уходе                               |

После первой попытки отправки все поля проверяются на каждый ввод — ошибка исчезает, как
только исправили. При вводе перепроверяются и другие поля с ошибками («пароли не совпадают»).

## Отправка

| Как                               | Что происходит                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `data-form-ajax`                  | `fetch(action, FormData)` — файлы тоже уходят. Ответ JSON `{ message }` → статус |
| `ctx.options.onSubmit` (JS/React) | ваша функция получает приведённые данные: `(data, api) => …`                     |
| ничего                            | обычная отправка браузером (если всё верно)                                      |

**Ошибки с сервера** под полями: ответ 4xx `{ "errors": { "email": "Занят" } }` (или формат
Laravel `{ "email": ["Занят"] }`). Из `onSubmit` — выбросите ошибку с полем `errors`.
Ошибка с сервера держится, пока значение поля не изменят.

События на `<form>`: `form:invalid`, `form:submit` (можно отменить `preventDefault()` и
отправить по-своему, данные в `event.detail.data`), `form:success`, `form:error`.

```js
form.addEventListener('form:success', () => ym(12345, 'reachGoal', 'callback')) // цель Метрики
```

## Маски

| `data-mask`                  | Вид                | Особенности                                                         |
| ---------------------------- | ------------------ | ------------------------------------------------------------------- |
| `phone`                      | +7 (912) 345-67-89 | «8…» и «+7…» при вставке — код страны; при фокусе показывает «+7 (» |
| `date`                       | 31.12.2025         | вместе с `s.date()`                                                 |
| `time`                       | 23:59              |                                                                     |
| `inn`                        | 10 или 12 цифр     | вместе с `.inn()` — проверка контрольной цифры                      |
| `snils`                      | 112-233-445 95     | вместе с `.snils()`                                                 |
| `postcode`                   | 6 цифр             |                                                                     |
| `passport`                   | 45 06 123456       |                                                                     |
| `number`                     | 1 500 000,50       | `data-mask-decimals="2"`                                            |
| `data-mask-pattern="AA-999"` | свой шаблон        | `9` цифра, `A` буква, `*` буква или цифра                           |

Незаполненная до конца маска — ошибка «Заполните полностью». Отправляется значение с маской
(как видит пользователь); нужны «чистые» цифры — `.transform((v) => v.replace(/\D/g, ''))` в схеме
или `getMask(input).unmask(value)`.

## Поля

Модули полей и их разметка — [modules.md](modules.md): `select` (кастомный селект с поиском и
мультивыбором), `file-upload`, `password`, `autosize`, `char-counter`, `stepper`. Классы оформления: `.field`, `.field__label`, `.field__input`,
`.field__hint`, `.field__error`, `.field__control` + `.field__action`, `.choice`, `.choice-group`.

## Языки

Тексты ошибок по умолчанию берутся из словарей кита на языке страницы (`<html lang>`):
на английской версии сайта форма сама говорит по-английски. Поменять текст на всех
языках сразу — `addMessages('ru', { kit: { schema: { required: '…' } } })`.
Подробно — [i18n.md](i18n.md).

## Значения формы

```js
import { formValues } from 'kit/js/form/index.js'
formValues(form) // { name: 'Иван', consent: true, services: ['seo'], files: [File], contact: 'email' }
```

## React

```jsx
const schema = s.object({ … })               // ВНЕ компонента
const OPTIONS = { schema, ajax: true }

function Callback() {
  const ref = useModule(form, OPTIONS)
  return <form ref={ref} action="/api/callback" noValidate>…</form>
}
```

Своя отправка: `useModule(form, { schema, onSubmit })`, где `onSubmit` — из `useCallback`
или вне компонента. Для сложных форм с зависимыми полями и пошаговыми мастерами в React
естественнее react-hook-form + zod — схемы `s.*` и zod там взаимозаменяемы по смыслу.
