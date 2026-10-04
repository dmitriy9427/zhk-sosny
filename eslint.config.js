/**
 * ESLint: ловит ошибки до запуска (опечатки в переменных, забытые await,
 * нарушения правил хуков React). Запуск: npm run lint:js, автоисправление: npm run fix.
 * Стиль (отступы, кавычки) — забота Prettier, ESLint его не проверяет.
 */
import js from '@eslint/js'
import globals from 'globals'

// Плагин правил хуков нужен только React-проектам. В vanilla-проекте его нет
// в зависимостях — поэтому подключаем, только если он установлен.
const reactHooks = await import('eslint-plugin-react-hooks').then((m) => m.default).catch(() => null)
// TypeScript-правила — только если в проекте есть TS (стартер react-ts).
const tseslint = await import('typescript-eslint').then((m) => m.default).catch(() => null)

export default [
  { ignores: ['**/dist/**', '**/coverage/**', '.tmp/**', '**/node_modules/**', '**/.astro/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none' }],
      // console.log забывают в продакшене; warn/error — осознанные сообщения.
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'groupCollapsed', 'groupEnd'] }],
    },
  },
  ...(tseslint
    ? tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] }))
    : [{ ignores: ['**/*.{ts,tsx}'] }]),
  ...(reactHooks
    ? [
        {
          files: ['**/*.{jsx,tsx}', 'kit/react/**/*.js'],
          plugins: { 'react-hooks': reactHooks },
          rules: reactHooks.configs.recommended.rules,
        },
      ]
    : []),
  {
    files: ['**/*.config.{js,mjs,ts}', 'scripts/**', 'kit/vite/**', '**/mocks/**'],
    languageOptions: { globals: { ...globals.node } },
    // Скрипты командной строки общаются с человеком через console.log — это норма.
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', 'test/**'],
    languageOptions: { globals: { ...globals.node, setMedia: 'readonly', triggerIntersect: 'readonly' } },
  },
]
