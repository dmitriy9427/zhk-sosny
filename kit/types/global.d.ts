/**
 * Глобальные типы кита для проверки TypeScript (npm run typecheck).
 * Этот файл ничего не делает при запуске — только помогает редактору.
 */
import 'react'

declare global {
  interface Window {
    /** Приложение kit — в разработке доступно из консоли. */
    __kit?: unknown
    /** Dev-панель (только в разработке). */
    __KIT_DEVTOOLS__?: unknown
  }

  /** Запись PerformanceObserver типа 'layout-shift' (CLS) — пока нет в стандартных типах. */
  interface LayoutShift extends PerformanceEntry {
    value: number
    hadRecentInput: boolean
    sources?: { node?: Node }[]
  }
}

declare module 'react' {
  // style={{ '--gap': '24px' }} — CSS-переменные в JSX.
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}

export {}
