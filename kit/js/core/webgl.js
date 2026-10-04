/**
 * Помощники для WebGL-сцен (three.js).
 *
 * Файл НЕ импортирует three: three весит ~600 КБ и должен грузиться только
 * когда 3D реально нужно (динамический import в модуле). Здесь — то, что
 * нужно ДО загрузки three: есть ли WebGL, загрузка картинок, уборка.
 * @module kit/core/webgl
 */

let webglSupport = null

/**
 * Поддерживает ли браузер WebGL. Результат кешируется: проверка создаёт
 * контекст, а их у браузера ограниченное число (~16).
 * Без WebGL модули с 3D откатываются на обычную DOM-версию.
 */
export function supportsWebGL() {
  if (webglSupport !== null) return webglSupport
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    webglSupport = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglSupport = false
  }
  return webglSupport
}

/** Сбросить кеш проверки (тесты). */
export const resetWebGLCache = () => (webglSupport = null)

/**
 * Загрузить картинку полностью (для текстуры: из незагруженной картинки
 * получится чёрный прямоугольник). Ошибка загрузки → Promise отклоняется.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // Картинки с другого домена в WebGL можно использовать, только если сервер
    // разрешил (CORS). Без crossOrigin браузер «испортит» canvas, и three упадёт.
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`[kit] не удалось загрузить картинку ${src}`))
    image.src = src
  })
}

/**
 * Полностью освободить рендерер three.js: ресурсы, WebGL-контекст, canvas.
 * Без forceContextLoss контекст освобождается только сборщиком мусора, а при
 * переходах между страницами (SPA) можно упереться в лимит браузера.
 */
export function releaseRenderer(renderer) {
  renderer.dispose()
  renderer.forceContextLoss?.()
  renderer.domElement.remove()
}
