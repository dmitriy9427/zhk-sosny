# Модули

Модуль — это поведение, которое включается атрибутом `data-module="имя"`. Несколько модулей на
одном элементе — через пробел: `data-module="reveal magnetic"`. Настройки — атрибутами
`data-<модуль>-<настройка>` (или `ctx.options` из JS/React — они важнее атрибутов).

Живые примеры всех модулей — страница **ui-kit.html** стартера.

## Каталог

| Модуль                          | Для чего                                              | Загрузка |
| ------------------------------- | ----------------------------------------------------- | -------- |
| [reveal](#reveal)               | Появление элементов при прокрутке                     | сразу    |
| [menu](#menu)                   | Мобильное меню (бургер)                               | сразу    |
| [sticky-header](#sticky-header) | Шапка прячется при прокрутке вниз                     | сразу    |
| [theme-switch](#theme-switch)   | Светлая/тёмная тема                                   | сразу    |
| [accordion](#accordion)         | Раскрывающиеся блоки, FAQ                             | лениво   |
| [tabs](#tabs)                   | Вкладки (состояние в адресе)                          | лениво   |
| [dialog](#dialog)               | Модальное окно (открывается и по ссылке #id)          | лениво   |
| [slider](#slider)               | Карусель на scroll-snap                               | лениво   |
| [marquee](#marquee)             | Бегущая строка                                        | лениво   |
| [split-text](#split-text)       | Заголовок появляется по строкам/словам/буквам         | лениво   |
| [counter](#counter)             | Число «набегает»                                      | лениво   |
| [parallax](#parallax)           | Параллакс                                             | лениво   |
| [magnetic](#magnetic)           | Кнопка тянется за курсором                            | лениво   |
| [scroll-top](#scroll-top)       | Кнопка «Наверх»                                       | лениво   |
| [lazy-video](#lazy-video)       | Фоновое видео: грузится и играет, только когда видно  | лениво   |
| [form](#form)                   | Проверка, маски, отправка формы                       | лениво   |
| [mask](#mask)                   | Маска на отдельном поле                               | лениво   |
| [file-upload](#file-upload)     | Загрузка файлов                                       | лениво   |
| [password](#password)           | Показать/скрыть пароль                                | лениво   |
| [autosize](#autosize)           | Textarea растёт по тексту                             | лениво   |
| [char-counter](#char-counter)   | Счётчик символов                                      | лениво   |
| [stepper](#stepper)             | Поле количества − 1 +                                 | лениво   |
| [toast](#toast)                 | Уведомления (`toast()` из JS или кнопки `data-toast`) | лениво   |

«Лениво» — код модуля скачивается, только если такой блок есть на странице.

---

### reveal

Ставится на контейнер (хоть на `<main>`), анимирует потомков с `data-reveal`.

```html
<main data-module="reveal">
  <h2 data-reveal>Заголовок</h2>
  <p data-reveal="fade" data-reveal-delay="0.2">Текст</p>
</main>
```

Пресеты `data-reveal`: `up` (по умолчанию), `down`, `left`, `right`, `fade`, `scale`, `clip`.
Настройки корня: `start` ('top 85%'), `duration` (0.9), `stagger` (0.08), `once` (true).
Элементы, появляющиеся вместе, идут «волной».

### menu

На кнопку-бургер; панель — по id.

```html
<button class="burger" data-module="menu" data-menu-target="site-menu"><span class="burger__lines"></span></button>
<nav id="site-menu" class="mobile-menu" data-lenis-prevent>…</nav>
```

Настройки: `target`, `closeAbove` ('lg' — закрыть при расширении экрана), `labelOpen`, `labelClose`.
API: `open()`, `close()`, `toggle()`. Событие `menu:toggle`. Esc, клик по ссылке — закрывают.

### sticky-header

```html
<header class="header" data-module="sticky-header">…</header>
```

Классы `is-scrolled`, `is-hidden`. Пишет высоту шапки в `--header-height` (для якорей).
Настройки: `hide` (true), `offset` (80), `tolerance` (8).

### theme-switch

```html
<button class="theme-switch" data-module="theme-switch" aria-label="Тёмная тема"></button>
```

Тема — `data-theme` на `<html>`, запоминается. Без выбора — системная. Инлайн-скрипт в `<head>`
стартера применяет тему до отрисовки (без «вспышки»).

### accordion

```html
<div class="accordion" data-module="accordion">
  <div class="accordion__item" data-accordion-item data-open>
    <h3><button class="accordion__trigger" data-accordion-trigger>Вопрос</button></h3>
    <div class="accordion__panel" data-accordion-panel><div class="accordion__inner">Ответ</div></div>
  </div>
</div>
```

Настройки: `multiple` (false), `hash` (true — открыть пункт, чей `id` в адресе).
API: `open(i)`, `close(i)`, `toggle(i)`, `isOpen(i)`. Событие `accordion:toggle`.
`.accordion__inner` обязателен — на нём держится анимация высоты.

### tabs

```html
<div class="tabs" data-module="tabs" id="product">
  <div class="tabs__list" data-tabs-list>
    <button class="tabs__tab" data-tabs-tab>Описание</button>
    <button class="tabs__tab" data-tabs-tab>Отзывы</button>
  </div>
  <div class="tabs__panel" data-tabs-panel id="about">…</div>
  <div class="tabs__panel" data-tabs-panel id="reviews">…</div>
</div>
```

Открытая вкладка хранится в адресе: `?product=reviews` — после перезагрузки и по ссылке
откроется она же. Имя параметра: `data-tabs-param` → `id` корня → `tab`. Значение:
`data-tabs-value` вкладки → `id` панели → номер с 1. Вкладка по умолчанию в адрес не пишется.
Настройки: `active` (0), `url` (true), `param`. API: `select(i)`, `index`. Событие `tabs:change`.

### dialog

```html
<button data-dialog-open="callback">Заказать звонок</button>
<a href="#callback">или ссылкой</a>
<dialog id="callback" class="dialog" data-module="dialog" aria-labelledby="callback-title">
  <div class="dialog__box">
    <button class="dialog__close" data-dialog-close aria-label="Закрыть">×</button>
    <h2 id="callback-title">Заказать звонок</h2>
  </div>
</dialog>
```

Адрес `/page#callback` открывает окно сразу — ссылку можно отправить. Открытие добавляет
запись в историю: «Назад» на телефоне закрывает окно.
Настройки: `closeOnBackdrop` (true), `closeTimeout` (400), `hash` (true).
API: `open()`, `close()`, `isOpen`. События `dialog:open`, `dialog:close`.

### slider

```html
<div class="slider" data-module="slider" style="--slide-width: 80%">
  <div class="slider__track" data-slider-track>
    <div class="slider__slide">…</div>
  </div>
  <div class="slider__nav">
    <button class="slider__arrow" data-slider-prev aria-label="Назад">←</button>
    <div class="slider__dots" data-slider-dots></div>
    <button class="slider__arrow" data-slider-next aria-label="Вперёд">→</button>
  </div>
</div>
```

Настройки: `autoplay` (0 — выкл., иначе мс), `dotLabel`. API: `goTo(i)`, `next()`, `prev()`, `index`.
Нужна бесконечная петля или эффекты (fade, 3D) — берите Swiper/Embla для этого блока.

### marquee

```html
<div class="marquee" data-module="marquee" data-marquee-speed="60">
  <ul class="marquee__track" data-marquee-track>
    <li>…</li>
  </ul>
</div>
```

Настройки: `speed` (px/с), `reverse`, `pauseOnHover`.

### split-text

```html
<h2 data-module="split-text" data-split-text-type="lines">Заголовок</h2>
```

`type`: `lines` | `words` | `chars`. Также `start`, `stagger`, `duration`.

### counter

```html
<span class="counter" data-module="counter" data-counter-suffix="+">1 500</span>
```

Итоговое число — в разметке (видно без JS и поисковикам). Настройки: `to`, `from`, `duration`,
`decimals`, `prefix`, `suffix`, `locale`.

### parallax

```html
<div data-module="parallax" data-parallax-speed="0.3"><img src="…" alt="" /></div>
```

`speed`: 0 — без сдвига, отрицательный — обгоняет прокрутку.

### magnetic

```html
<a class="btn" data-module="magnetic" data-magnetic-strength="0.3">Связаться</a>
```

Только при мыши. `strength` (0.35).

### scroll-top

```html
<button class="scroll-top" data-module="scroll-top" aria-label="Наверх">↑</button>
```

`after`: px или доля высоты экрана (≤ 1), по умолчанию 1 экран.

### lazy-video

```html
<video
  data-module="lazy-video"
  data-src="/video/bg.mp4"
  poster="/video/bg.jpg"
  muted
  loop
  playsinline
  preload="none"
></video>
```

### form

Подробно — [forms.md](forms.md).

```html
<form
  data-module="form"
  data-form-ajax
  data-form-schema="callback"
  action="/api/callback"
  method="post"
  novalidate
></form>
```

Настройки: `ajax`, `mode` (onTouched | onBlur | onChange | onSubmit | all), `schema`,
`resetOnSuccess`, `success`, `failure`, `invalid`. Из JS: `ctx.options.onSubmit(data, api)`.
API: `getValues()`, `validate()`, `validateField(name)`, `setErrors({})`, `clearErrors()`,
`errors`, `reset()`, `submit()`. События: `form:invalid`, `form:submit` (отменяемое),
`form:success`, `form:error`.

### mask

```html
<input data-module="mask" data-mask="phone" />
```

Внутри формы с `data-module="form"` маски включаются сами — модуль не нужен. Список масок —
[forms.md](forms.md#маски).

### file-upload

```html
<div class="upload" data-module="file-upload" data-file-upload-max-files="3" data-file-upload-max-size="5">
  <input class="upload__input" type="file" name="files" id="files" multiple accept="image/*,.pdf" />
  <label class="upload__zone" for="files">Перетащите или <u>выберите</u> <small data-file-upload-hint></small></label>
  <ul class="upload__list" data-file-upload-list></ul>
</div>
```

Настройки: `maxFiles`, `maxSize` (МБ), `accept`, `preview`. API: `files`, `add(files)`, `clear()`.
Событие `file-upload:change`.

### password

```html
<div class="field__control" data-module="password">
  <input class="field__input" type="password" name="password" />
  <button class="field__action" type="button" data-password-toggle></button>
</div>
```

### autosize

```html
<textarea class="field__input" data-module="autosize"></textarea>
```

### char-counter

```html
<textarea maxlength="500" data-module="char-counter"></textarea>
```

`max` — если обрезать ввод не нужно (тогда без `maxlength`).

### stepper

```html
<div class="stepper" data-module="stepper">
  <button type="button" data-stepper-dec aria-label="Меньше">−</button>
  <input type="number" name="qty" value="1" min="1" max="10" />
  <button type="button" data-stepper-inc aria-label="Больше">+</button>
</div>
```

### toast

```js
import { toast } from 'kit/js/modules/toast/index.js'
toast('Сохранено', { type: 'success' }) // info | success | warning | error
toast('Ошибка сети', { type: 'error', duration: 0 }) // 0 — пока не закроют
```

Без JS: `<div data-module="toast"><button data-toast="Скопировано" data-toast-type="success">`.

### select

Поверх настоящего `<select>` — он остаётся в форме (отправка, проверка, reset работают).

```html
<select name="city" data-module="select" data-select-search data-select-clearable>
  <option value="">Начните вводить город</option>
  <!-- пустой первый option = подсказка -->
  <optgroup label="Центр"><option value="msk">Москва</option></optgroup>
</select>
<select name="skills[]" multiple data-module="select" data-select-search data-select-max="4">
  …
</select>
```

Настройки: `search`, `placeholder`, `max`, `clearable`, `closeOnSelect`. Из JS: `ctx.options.load = async (query) => [{ value, label }]`
— варианты с сервера. API: `value`, `setValue(v)`, `open()`, `close()`, `refresh()`, `clear()`.
Список открывается в верхнем слое браузера (Popover API) — не обрезается модалкой.

### lang-switch

Ссылками на языковые версии (сайты, SEO) или кнопками `data-lang="en"` (смена «на лету»).
Подробно — [i18n.md](i18n.md).

### swiper

```html
<section>
  <div class="swiper-nav"><button class="swiper-button-prev"></button><button class="swiper-button-next"></button></div>
  <div
    class="swiper"
    data-module="swiper"
    data-swiper-preset="coverflow"
    data-swiper-breakpoints='{"md": {"slidesPerView": 2}}'
  >
    <div class="swiper-wrapper"><div class="swiper-slide">…</div></div>
    <div class="swiper-pagination"></div>
  </div>
</section>
```

Пресеты: `default`, `fade`, `cards`, `coverflow`, `creative`, `center`, `marquee`, `vertical`, `free`, `grid`.
Свои опции Swiper — `data-swiper-options='{...}'`. Брейкпоинты — по именам из SCSS.
Стрелки/точки ищутся внутри слайдера, затем в секции (или `data-swiper-controls="#id"`).
Миниатюры — `data-swiper-thumbs="#thumbs"`. API: `swiper` (экземпляр Swiper). Событие `swiper:change`.
Когда брать `slider` (scroll-snap), а когда `swiper`: нужна петля, эффекты, миниатюры — swiper;
простая лента карточек — slider (легче, родная прокрутка).

### infinite-slider

```html
<div class="infinite" data-module="infinite-slider" data-infinite-slider-mode="3d">
  <div class="infinite__viewport" data-infinite-viewport>
    <figure class="infinite__slide" data-infinite-slide data-title="Подпись">
      <div class="infinite__art" data-infinite-art><img src="…" alt="…" /></div>
    </figure>
    …
  </div>
  <p class="infinite__title" data-infinite-title></p>
  <p class="infinite__counter" data-infinite-counter></p>
  <button data-infinite-prev>←</button><button data-infinite-next>→</button>
</div>
```

Настройки: `mode` (dom | 3d), `skew`, `parallax`, `curve`, `reflection`, `snap`, `bounce`. Размеры — CSS-переменные
`--infinite-slide-width/height`, `--infinite-gap`. 3D: three.js грузится только для этого режима;
без WebGL — DOM-версия. Картинки с другого домена для 3D — только с CORS.

### infinite-gallery

```html
<section class="gallery" data-module="infinite-gallery" style="--gallery-columns: 6">
  <div class="gallery__pin" data-gallery-pin>
    <div class="gallery__viewport" data-gallery-viewport tabindex="0">
      <div class="gallery__grid" data-gallery-grid>
        <figure class="gallery__item" data-gallery-item tabindex="0">
          <img src="…" alt="…" data-lightbox-title="…" />
        </figure>
      </div>
    </div>
  </div>
</section>
```

Число ячеек — кратно числу колонок (иначе дыры; в консоли подсказка). Настройки: `lag`, `dragSpeed`,
`columnStep`, `scrollFollow`, `drift` (JSON `[x, y]`), `tilt`, `pin`, `pinLength`, `lightbox`.

### lightbox

`<div data-module="lightbox"><img src="…" alt="…" data-lightbox data-lightbox-title="…" data-lightbox-meta="…"></div>`
или из JS: `createLightbox().open(img, { title, meta, credit })`.

### hscroll

```html
<section class="hscroll" data-module="hscroll" data-hscroll-min="md">
  <div class="hscroll__pin" data-hscroll-pin>
    <div class="hscroll__progress" data-hscroll-progress></div>
    <div class="hscroll__track" data-hscroll-track>
      <article class="hscroll__card" data-hscroll-card>
        <img data-hscroll-zoom … /><span data-hscroll-scramble>2024</span>
      </article>
    </div>
  </div>
</section>
```

`min` — брейкпоинт, с которого включается (ниже — лента со scroll-snap). `scrub` — плавность.

### flip-filter

```html
<section data-module="flip-filter">
  <div class="flip-filter__tabs"><button data-filter="all">Все</button><button data-filter="site">Сайты</button></div>
  <div class="auto-grid"><article data-flip-item data-category="site landing">…</article></div>
</section>
```

Фильтр — в адресе (`?filter=site`, настройка `param`). Страница не «прыгает» при смене фильтра.

### stack-cards

`<div class="stack-cards" data-module="stack-cards"><article class="stack-cards__item" data-stack-card>…</article></div>`.
Настройки: `scale`, `dim`. Липкость — CSS `position: sticky` (не работает под `overflow: hidden` — предупреждение в консоли).

### scramble-text

`<h2 data-module="scramble-text">…</h2>`, при наведении — `data-scramble-text-on="hover"`. Настройки: `chars`, `duration`.

### draw-svg

`<svg data-module="draw-svg"><path data-draw d="…" /></svg>`; к скроллу — `data-draw-svg-scrub`.

### scroll-progress

`<div class="scroll-progress" data-module="scroll-progress"></div>`; по статье — `data-scroll-progress-target="#article"`.

### cursor

`<div class="cursor" data-module="cursor"></div>` в конце `<body>`; подсказка — `data-cursor="Смотреть"` на любом
элементе, размер — `data-cursor-size="96"`. Только при мыши.

---

## Свой модуль

```js
import { createDisposer } from 'kit/js/core/lifecycle.js'
import { readOptions } from 'kit/js/core/options.js'

// 1. Все настройки — со значениями по умолчанию: по ним понятен ТИП атрибута.
const DEFAULTS = { speed: 1, label: 'Открыть', loop: false }

export default function myModule(el, ctx = {}) {
  // 2. data-my-module-speed="2" → options.speed = 2 (число, т.к. по умолчанию число)
  const options = readOptions(el, 'my-module', DEFAULTS, ctx.options)
  // 3. Нужен обязательный элемент — понятная ошибка, а не «Cannot read properties of null».
  const button = el.querySelector('[data-my-module-button]')
  if (!button) throw new Error('[my-module] нужен [data-my-module-button] внутри')
  // 4. Всё, что включили, — сразу «на выключение».
  const d = createDisposer()
  d.listen(button, 'click', () => {})
  // 5. Уважаем просьбу «меньше движения».
  if (!ctx.reduced) {
    /* анимации */
  }
  // 6. destroy убирает ВСЁ: обработчики, таймеры, анимации, добавленные элементы.
  return { destroy: d.dispose }
}
```

Что есть в `ctx`: `bus` (шина событий), `scroll` (плавный скролл: `scrollTo`, `stop`, `start`),
`reduced` (меньше движения), `breakpoints`, `options` (из JS/React).

Правила, которые делают модуль надёжным:

- не ищите элементы по всему `document`, если они внутри `el`, — блоков может быть несколько;
- не храните состояние в глобальных переменных — у каждого блока своё;
- общение с другими модулями — через `ctx.bus.emit/on`, а не импорт;
- чистую логику (расчёты) выносите в отдельные функции с `export` — их легко тестировать;
- тест рядом: `my-module.test.js` (см. [testing.md](testing.md)).
