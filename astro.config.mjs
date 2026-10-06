/**
 * Настройки Astro.
 *
 * Astro собирает статические HTML-страницы (быстро и хорошо для SEO), а
 * JS отправляет в браузер только там, где он нужен. Модули кита
 * (data-module="…") оживляются одним скриптом в layouts/Base.astro.
 *
 * Сайт ЖК — только на русском. Страница каждой квартиры собирается
 * статически (src/pages/flats/[id].astro) — 270 HTML-файлов, их видят поисковики.
 *
 * site — адрес сайта на проде: нужен для sitemap.xml и абсолютных ссылок
 * (Open Graph). Поменяйте перед запуском.
 */
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import { kit } from './kit/vite/index.js'

const kitDir = fileURLToPath(new URL('./kit', import.meta.url))
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  // Адрес сайта (sitemap, Open Graph). На GitHub Pages — подпапка /zhk-sosny/
  // (BASE_URL задаёт .github/workflows/pages.yml).
  site: 'https://dmitriy9427.github.io',
  base: process.env.BASE_URL ?? '/',
  integrations: [sitemap()],
  server: { port: 4321 },
  vite: {
    resolve: { alias: { kit: kitDir, '@': `${root}src` } },
    css: {
      preprocessorOptions: { scss: { loadPaths: [dirname(kitDir), `${root}src/styles`] } },
      devSourcemap: true,
    },
    plugins: [...kit({ include: false, pages: false })],
    build: {
      // three.js (~600 КБ) — отдельный ленивый файл: грузится только для 3D-сцены.
      chunkSizeWarningLimit: 700,
    },
  },
})
