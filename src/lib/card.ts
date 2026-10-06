/**
 * Карточка квартиры (HTML-строка). Одна функция для сервера (Astro, set:html)
 * и для браузера (каталог рисует результаты фильтра) — вид везде одинаковый.
 * Текст вставляется только из наших данных (не от пользователя) — XSS нет.
 */
import { FINISH_LABEL, ROOM_LABEL, STATUS_LABEL, VIEW_LABEL, formatPrice, type Flat } from '../data/flats'
import { withBase } from './base'

export const flatTitle = (f: Flat) => `${ROOM_LABEL[f.rooms]}, ${f.area.toLocaleString('ru-RU')} м²`

export function cardHtml(f: Flat) {
  return `<article class="flat-card flat-card--${f.status}" data-flat="${f.id}">
  <a class="flat-card__link" href="${withBase(`/flats/${f.id}/`)}" aria-label="${flatTitle(f)}, ${formatPrice(f.price)}"></a>
  <div class="flat-card__plan"><img src="${withBase(`/plans/${f.layout}.svg`)}" alt="" width="300" height="200" loading="lazy" decoding="async"></div>
  <div class="flat-card__body">
    <p class="flat-card__meta">Башня ${f.tower} · ${f.floor} этаж · №${f.number}</p>
    <h3 class="flat-card__title">${flatTitle(f)}</h3>
    <p class="flat-card__tags"><span>${VIEW_LABEL[f.view]}</span><span>${FINISH_LABEL[f.finish]}</span>${f.terrace ? '<span>Терраса</span>' : ''}</p>
    <p class="flat-card__price">${formatPrice(f.price)} <small>${f.pricePerMeter.toLocaleString('ru-RU')} ₽/м²</small></p>
  </div>
  <span class="flat-card__status">${STATUS_LABEL[f.status]}</span>
  <button class="flat-card__fav fav-button" type="button" data-favorite="${f.id}" aria-label="В избранное" aria-pressed="false">♥</button>
</article>`
}

/** Компактные данные для браузера (без лишних полей — меньше вес страницы). */
export const toClient = (flats: Flat[]) => flats
