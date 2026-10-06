/**
 * Путь от корня сайта с учётом base (на GitHub Pages сайт живёт в /zhk-sosny/).
 *
 *   withBase('/flats/')  // '/flats/' локально, '/zhk-sosny/flats/' на Pages
 *
 * Astro и Vite сами добавляют base только к своим файлам (CSS, JS, шрифты);
 * ссылки в разметке и строках — наша забота.
 */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
export const withBase = (path: string) => `${BASE}${path.startsWith('/') ? path : `/${path}`}`
