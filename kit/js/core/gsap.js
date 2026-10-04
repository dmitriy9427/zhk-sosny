/**
 * GSAP + ScrollTrigger: одна точка подключения.
 *
 * Импортируйте gsap ОТСЮДА (`import { gsap, ScrollTrigger } from 'kit/js/core/gsap'`),
 * а не из 'gsap' напрямую — тогда ScrollTrigger гарантированно зарегистрирован
 * и настроен. Остальные плагины (SplitText, Draggable, Flip…) модули
 * регистрируют сами — так они попадают в сборку, только если реально нужны.
 * gsap.registerPlugin можно вызывать сколько угодно раз — это безопасно.
 *
 * Все плагины GSAP с версии 3.13 бесплатны, в том числе для коммерции.
 * @module kit/core/gsap
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// На телефонах при прокрутке появляется/прячется адресная строка браузера,
// высота окна меняется — и ScrollTrigger по умолчанию всё пересчитывает.
// Отсюда «прыжки» анимаций и пинов на мобилке. Отключаем пересчёт, если
// поменялась только высота окна.
ScrollTrigger.config({ ignoreMobileResize: true })

export { gsap, ScrollTrigger }
