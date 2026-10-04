/**
 * WebGL-рендерер бесконечной ленты — «барабан» (three.js, грузится лениво).
 *
 * ─── Идея ───────────────────────────────────────────────────────────────────
 * Каждый слайд — плоскость (PlaneGeometry) с текстурой-фото, плюс вторая
 * плоскость под ней — отражение «в полу». Изгиб на цилиндр, наклон на
 * скорости, затенение краёв, RGB-сдвиг и скругление углов делают шейдеры
 * (glsl.js): вершинный двигает вершины, фрагментный красит пиксели.
 *
 * ─── Почему «1 единица = 1 пиксель» ───────────────────────────────────────────
 * Камера (PerspectiveCamera) поставлена на такое расстояние, что на
 * плоскости z = 0 одна единица мира равна одному CSS-пикселю:
 *   camera.z = (высота / 2) / tan(угол обзора / 2).
 * Тогда размеры слайдов можно брать прямо из CSS (offsetWidth/Height) и
 * передавать в шейдер в пикселях — никаких пересчётов.
 *
 * ─── Почему frustumCulled = false ──────────────────────────────────────────────
 * three.js не рисует объекты вне поля зрения камеры, проверяя их ИСХОДНУЮ
 * геометрию. Но мы двигаем вершины в шейдере — исходная плоскость 1×1 в
 * центре не совпадает с тем, где слайд на самом деле. Отключаем проверку.
 *
 * Рисует только по запросу из index.js (когда лента движется).
 * @module kit/modules/infinite-slider/gl-renderer
 */
import {
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
} from 'three'
import { rad } from '../../core/math.js'
import { releaseRenderer } from '../../core/webgl.js'
import { slideFragment, slideVertex } from './glsl.js'

const FOV = 35

/**
 * @param {HTMLElement} container Куда вставить canvas.
 * @param {HTMLImageElement[]} images Загруженные фото слайдов (тот же домен — без CORS).
 * @param {{ dpr: number }} quality dpr — плотность пикселей canvas (2 — чётко на Retina, 1 — быстрее).
 * @param {{ curve?: number, bend?: number, rgb?: number, shade?: number, reflection?: number, radius?: number, gap?: number }} [options]
 */
export function createGlRenderer(container, images, quality, options = {}) {
  const { curve = 1.1, bend = 1, rgb = 0.7, shade = 0.65, reflection = 0.35, radius = 18, gap = 18 } = options
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  const scene = new Scene()
  const camera = new PerspectiveCamera(FOV, 1, 1, 10000)
  const geometry = new PlaneGeometry(1, 1, 32, 8)
  let size = { width: 1, height: 1, slideWidth: 1, slideHeight: 1 }

  renderer.setPixelRatio(quality.dpr)
  renderer.domElement.className = 'infinite__canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.appendChild(renderer.domElement)

  const textures = images.map((image) => {
    const texture = new Texture(image)

    texture.needsUpdate = true
    texture.colorSpace = SRGBColorSpace
    texture.minFilter = LinearFilter
    texture.generateMipmaps = false
    return texture
  })

  const makeMesh = (texture, image, mirror) => {
    const material = new ShaderMaterial({
      vertexShader: slideVertex,
      fragmentShader: slideFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTexture: { value: texture },
        uImage: { value: new Vector2(image.naturalWidth || image.width, image.naturalHeight || image.height) },
        uCenter: { value: new Vector2() },
        uPlane: { value: new Vector2(1, 1) },
        uCurve: { value: 0 },
        uSpeed: { value: 0 },
        uBend: { value: bend },
        uRgb: { value: rgb },
        uShade: { value: shade },
        uMirror: { value: mirror ? 1 : 0 },
        uReflection: { value: reflection },
        uGap: { value: gap },
        uRadius: { value: radius },
      },
    })
    const mesh = new Mesh(geometry, material)

    // Вершины сдвигаются в шейдере — стандартная проверка видимости не годится.
    mesh.frustumCulled = false
    mesh.renderOrder = mirror ? 0 : 1
    scene.add(mesh)
    return mesh
  }

  const planes = textures.map((texture, i) => ({
    slide: makeMesh(texture, images[i], false),
    mirror: reflection > 0 ? makeMesh(texture, images[i], true) : null,
  }))

  return {
    resize(width, slideWidth, slideHeight, height = container.clientHeight) {
      size = { width, height, slideWidth, slideHeight }
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(height, 1)
      camera.position.z = height / 2 / Math.tan(rad(FOV / 2))
      camera.updateProjectionMatrix()
    },
    /** @param {ReturnType<typeof import('./engine.js').createInfiniteEngine>} engine */
    render(engine) {
      const curveRadius = curve > 0 ? size.width / curve : 0
      // Слайд чуть выше центра — под ним место для отражения.
      const centerY = reflection > 0 ? size.slideHeight * 0.12 : 0

      planes.forEach(({ slide, mirror }, i) => {
        const offset = engine.offset(i)
        const visible = Math.abs(offset) < size.width / 2 + size.slideWidth * 1.5

        ;[slide, mirror].forEach((mesh) => {
          if (!mesh) return
          mesh.visible = visible
          if (!visible) return

          const u = mesh.material.uniforms

          u.uCenter.value.set(offset, centerY)
          u.uPlane.value.set(size.slideWidth, size.slideHeight)
          u.uCurve.value = curveRadius
          u.uSpeed.value = engine.speed
        })
      })
      renderer.render(scene, camera)
    },
    dispose() {
      planes.forEach(({ slide, mirror }) => {
        slide.material.dispose()
        mirror?.material.dispose()
      })
      textures.forEach((texture) => texture.dispose())
      geometry.dispose()
      releaseRenderer(renderer)
    },
  }
}
