/**
 * Настройки тестов (Vitest).
 * - jsdom: «браузер в памяти» — есть document, но НЕТ вёрстки (размеры = 0).
 *   Всё, что зависит от размеров, в тестах подменяется (см. test/setup.js).
 * - alias `kit` — тот же, что в vite.config стартеров, чтобы импорты совпадали.
 */
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      kit: fileURLToPath(new URL('./kit', import.meta.url)),
      // Помощники тестов: import { html } from '@test/helpers.js' — из любой глубины папок.
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: ['**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '.tmp/**'],
    restoreMocks: true,
    coverage: {
      include: ['kit/**/*.{js,jsx}', 'scripts/**/*.mjs', 'starters/*/src/**/*.{js,jsx}'],
      exclude: ['**/*.test.*', '**/index.js'],
    },
  },
})
