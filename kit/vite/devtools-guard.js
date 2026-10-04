/**
 * Vite-плагин: сборка ПАДАЕТ, если dev-инструменты попали в продакшн.
 *
 * Dev-инструменты (kit/devtools) подключаются так:
 *   if (import.meta.env.DEV) import('kit/devtools').then(…)
 * При сборке Vite заменяет import.meta.env.DEV на false, условие становится
 * «if (false)», и сборщик выбрасывает импорт целиком. Но достаточно один раз
 * написать импорт без условия (или вынести условие в переменную, которую
 * сборщик не может вычислить) — и сетка, панель и FPS-счётчик уедут к
 * заказчику. Этот плагин ищет в готовых файлах метку из kit/devtools и
 * останавливает сборку с объяснением.
 * @module kit/vite/devtools-guard
 */

export const DEVTOOLS_MARKER = '__KIT_DEVTOOLS__'

export function devtoolsGuard() {
  return {
    name: 'kit:devtools-guard',
    apply: 'build',
    generateBundle(_, bundle) {
      const leaked = Object.values(bundle)
        .filter((file) => (file.type === 'chunk' ? file.code : String(file.source ?? '')).includes(DEVTOOLS_MARKER))
        .map((file) => file.fileName)
      if (leaked.length) {
        this.error(
          `Dev-инструменты попали в продакшн-сборку (${leaked.join(', ')}).\n` +
            `Подключайте их только так: if (import.meta.env.DEV) import('kit/devtools')…\n` +
            `Подробнее: docs/troubleshooting.md, раздел «Dev-инструменты в продакшне».`,
        )
      }
    },
  }
}
