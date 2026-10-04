/**
 * 3D-сцена квартала на three.js: три башни, сосны, река, вечерний свет.
 * Всё строится кодом — без моделей и фотографий (лёгкая загрузка, любой цвет).
 *
 * ─── Из чего собрано ─────────────────────────────────────────────────────────
 * - Башни: BoxGeometry + текстура фасада, нарисованная на canvas (сетка окон,
 *   часть окон «горит» тёплым светом — вечер). Текстура в emissiveMap —
 *   окна светятся сами, без источников света.
 * - Сосны: InstancedMesh — 400 деревьев одним вызовом отрисовки (draw call).
 * - Река: плоскость с тёмным отражающим материалом.
 * - Свет: тёплое «закатное» направленное + холодное небо (HemisphereLight).
 *
 * Наведение на башню — подсветка и подсказка, клик — переход к квартирам
 * башни. Поиск башни под курсором — Raycaster.
 */
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three'
import { seeded } from '../../data/flats'

export interface TowerInfo {
  tower: number
  free: number
}

const FLOORS = 16

/** Текстура фасада: стена, ряды окон, часть окон горит. */
function facadeTexture(seed: number, lit: boolean) {
  const rnd = seeded(seed)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 512
  const g = canvas.getContext('2d')!
  g.fillStyle = lit ? '#000' : '#d9d2c6'
  g.fillRect(0, 0, canvas.width, canvas.height)
  const cols = 6
  const rows = FLOORS
  const cw = canvas.width / cols
  const rh = canvas.height / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = rnd() < 0.42
      if (lit) {
        if (!on) continue
        const warm = 200 + Math.floor(rnd() * 55)
        g.fillStyle = `rgb(255, ${warm}, ${Math.floor(warm * 0.55)})`
      } else {
        g.fillStyle = on ? '#3d4a52' : '#2a343b'
      }
      g.fillRect(c * cw + cw * 0.18, r * rh + rh * 0.22, cw * 0.64, rh * 0.6)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function createScene(container: HTMLElement, towers: TowerInfo[], dpr: number) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(dpr)
  renderer.shadowMap.enabled = true
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.outputColorSpace = SRGBColorSpace
  renderer.domElement.className = 'building3d__canvas'
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.fog = new Fog(new Color('#2b3540'), 60, 170)
  const camera = new PerspectiveCamera(32, 1, 0.5, 400)

  // Свет: закатное солнце + небо/земля.
  scene.add(new HemisphereLight('#c9d8ff', '#3a2f22', 0.9))
  const sun = new DirectionalLight('#ffb27a', 2.6)
  sun.position.set(-40, 30, 25)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 140 })
  scene.add(sun)

  // Земля и река.
  const ground = new Mesh(new PlaneGeometry(300, 300), new MeshStandardMaterial({ color: '#2f3a2c', roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  const river = new Mesh(
    new PlaneGeometry(300, 26),
    new MeshStandardMaterial({ color: '#1d3346', roughness: 0.15, metalness: 0.6 }),
  )
  river.rotation.x = -Math.PI / 2
  river.position.set(0, 0.05, 30)
  scene.add(river)
  const embankment = new Mesh(new BoxGeometry(300, 0.6, 3), new MeshStandardMaterial({ color: '#8a8173' }))
  embankment.position.set(0, 0.3, 16)
  embankment.receiveShadow = true
  scene.add(embankment)

  // Башни.
  const towerGroup = new Group()
  scene.add(towerGroup)
  const towerMeshes: Mesh[] = []
  const heights = [44, 48, 52]
  towers.forEach((info, i) => {
    const height = heights[i] ?? 46
    const geometry = new BoxGeometry(12, height, 12)
    geometry.translate(0, height / 2, 0)
    const day = facadeTexture(info.tower * 101, false)
    const lit = facadeTexture(info.tower * 101, true)
    const material = new MeshStandardMaterial({
      map: day,
      emissiveMap: lit,
      emissive: new Color('#ffb36b'),
      emissiveIntensity: 1.1,
      roughness: 0.75,
    })
    const mesh = new Mesh(geometry, material)
    mesh.position.set((i - 1) * 20, 0, -i * 6)
    mesh.rotation.y = 0.12 * (i - 1)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData = info
    towerGroup.add(mesh)
    towerMeshes.push(mesh)
    // Крыша-«корона».
    const crown = new Mesh(new BoxGeometry(12.6, 1.2, 12.6), new MeshStandardMaterial({ color: '#3b3a37' }))
    crown.position.set(mesh.position.x, height + 0.6, mesh.position.z)
    crown.rotation.y = mesh.rotation.y
    towerGroup.add(crown)
  })

  // Сосны: один InstancedMesh на кроны, один — на стволы.
  const rnd = seeded(7)
  const COUNT = 400
  const crowns = new InstancedMesh(
    new ConeGeometry(1.6, 6, 7),
    new MeshStandardMaterial({ color: '#1f3a2a', roughness: 1 }),
    COUNT,
  )
  const trunks = new InstancedMesh(
    new CylinderGeometry(0.25, 0.3, 2, 5),
    new MeshStandardMaterial({ color: '#5a3b26' }),
    COUNT,
  )
  crowns.castShadow = true
  const dummy = new Object3D()
  let placed = 0
  while (placed < COUNT) {
    const x = (rnd() - 0.5) * 220
    const z = -20 - rnd() * 110 + (rnd() < 0.3 ? 40 : 0)
    // Не сажаем деревья в башни и в реку.
    if (Math.abs(x) < 34 && z > -32) continue
    if (z > 12) continue
    const s = 0.7 + rnd() * 0.8
    dummy.position.set(x, 1 + 3 * s, z)
    dummy.scale.setScalar(s)
    dummy.updateMatrix()
    crowns.setMatrixAt(placed, dummy.matrix)
    dummy.position.y = 1 * s
    dummy.updateMatrix()
    trunks.setMatrixAt(placed, dummy.matrix)
    placed++
  }
  scene.add(crowns, trunks)

  // ─── Наведение ─────────────────────────────────────────────────────────────
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  let hovered: Mesh | null = null

  function pick(clientX: number, clientY: number): TowerInfo | null {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(towerMeshes, false)[0]
    const mesh = (hit?.object as Mesh) ?? null
    if (mesh !== hovered) {
      if (hovered) (hovered.material as MeshStandardMaterial).emissiveIntensity = 1.1
      hovered = mesh
      if (hovered) (hovered.material as MeshStandardMaterial).emissiveIntensity = 2.4
    }
    return (mesh?.userData as TowerInfo) ?? null
  }

  // ─── Камера: орбита + сдвиг от прокрутки и мыши ───────────────────────────
  let width = 1
  let height = 1
  return {
    resize(w: number, h: number) {
      width = w
      height = h
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(h, 1)
      // Узкий экран — камера дальше, чтобы башни помещались.
      camera.fov = camera.aspect < 1 ? 48 : 32
      // Широкий экран — квартал сдвигаем вправо: слева заголовок. Сдвиг
      // «окна» камеры, а не сцены — орбита и наведение мыши не ломаются.
      if (camera.aspect > 1.2) camera.setViewOffset(w, h, -w * 0.2, 0, w, h)
      else camera.clearViewOffset()
      camera.updateProjectionMatrix()
    },
    /**
     * @param time секунды
     * @param progress прокрутка секции 0…1
     * @param mx мышь −1…1
     */
    render(time: number, progress: number, mx: number, my: number) {
      const angle = -0.35 + time * 0.02 + mx * 0.12 + progress * 0.6
      const radius = 125 - progress * 30
      camera.position.set(Math.sin(angle) * radius, 30 + progress * 18 - my * 6, Math.cos(angle) * radius + 10)
      camera.lookAt(0, 20 - progress * 4, -6)
      renderer.render(scene, camera)
    },
    pick,
    get size() {
      return { width, height }
    },
    dispose() {
      scene.traverse((obj) => {
        const mesh = obj as Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as MeshStandardMaterial | undefined
        material?.map?.dispose()
        material?.emissiveMap?.dispose()
        material?.dispose()
      })
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
