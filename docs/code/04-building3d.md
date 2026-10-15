# 4. 3D-квартал

[src/modules/building3d/index.ts](../../src/modules/building3d/index.ts), [scene.ts](../../src/modules/building3d/scene.ts).
Глава — [02. 3D-квартал](../02-building3d.md).

## Где на экране

Первый экран главной: три башни среди сосен у реки, вечер, в окнах свет. Камера медленно облетает
квартал и поднимается при прокрутке; мышь даёт лёгкий параллакс. Наведение на башню — подсказка
«Башня 2 · свободно 52», клик — каталог этой башни.

## Как подключено

```astro
<div class="building3d" data-module="building3d" data-towers={JSON.stringify(towers)}>
  <p class="building3d__tooltip" hidden></p>
</div>
```

```ts
// scripts/app.ts
building3d: lazy(() => import('../modules/building3d/index')),
```

Данные башен (сколько свободных) посчитаны **при сборке** и лежат в атрибуте.

## Модуль: `index.ts`

```ts
export default async function building3d(el, ctx = {}) {
  if (!supportsWebGL()) return undefined
  const d = createDisposer()
  const towers = JSON.parse(el.dataset.towers ?? '[]')
  const { createScene } = await import('./scene')
  if (d.disposed) return undefined
```

- Нет WebGL — модуль ничего не делает, остаётся CSS-картинка-заглушка из разметки.
- **Двойная ленивость**: модуль сам ленивый (`lazy` в реестре), а внутри ещё `import('./scene')` —
  three.js (~600 КБ) скачивается последним, когда страница уже показана.
- `if (d.disposed)` — пока грузился three.js, модуль могли уже убрать (ушли со страницы).

```ts
const scene = createScene(el, towers, Math.min(window.devicePixelRatio || 1, 1.75))
d.add(() => scene.dispose())
const ro = new ResizeObserver(() => scene.resize(el.clientWidth, el.clientHeight))
ro.observe(el)
```

Плотность не больше 1,75 — на ретине почти вдвое меньше пикселей без заметной разницы.
`ResizeObserver` подгоняет холст под блок.

### Прокрутка и мышь

```ts
let progress = 0
const trigger = ScrollTrigger.create({
  trigger: el, start: 'top top', end: 'bottom top',
  onUpdate: (self) => (progress = self.progress),
})

const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
d.listen(el, 'pointermove', (event) => {
  mouse.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1
  const info = scene.pick(event.clientX, event.clientY)
  …подсказка…
})
```

ScrollTrigger здесь **не анимирует** — он только сообщает прогресс 0…1, а камера читает его в
каждом кадре. Мышь задаёт **цель** `tx/ty` (−1…1).

### Цикл кадров с инерцией

```ts
const tick = (_t, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.05)
  if (!ctx.reduced) time += dt
  const k = 1 - Math.exp(-dt * 3)
  mouse.x += (mouse.tx - mouse.x) * k
  mouse.y += (mouse.ty - mouse.y) * k
  scene.render(time, progress, mouse.x, mouse.y)
}
```

- `dt` — сколько прошло с прошлого кадра. `Math.min(…, 0.05)` — после переключения вкладки `dt`
  может быть огромным, и камера «прыгнула» бы.
- **Инерция**: текущая точка догоняет цель на долю расстояния каждый кадр. `1 - exp(-dt·3)` вместо
  константы — догоняет одинаково на мониторе 60 и 144 Гц.
- «Меньше движения» — время стоит: камера не облетает квартал сама.

```ts
d.add(onViewport(el, {
  enter: () => { if (!running) gsap.ticker.add(tick); running = true },
  leave: () => { gsap.ticker.remove(tick); running = false },
}))
```

**Кадры — только пока блок на экране.** Прокрутили ниже — видеокарта отдыхает.
`gsap.ticker` — тот же цикл кадров, что у GSAP: анимации и 3D в одном ритме.

## Сцена: `scene.ts`

### Фасад из canvas

```ts
function facadeTexture(seed: number, lit: boolean) {
  const rnd = seeded(seed)
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 512
  const g = canvas.getContext('2d')!
  g.fillStyle = lit ? '#000' : '#d9d2c6'
  g.fillRect(0, 0, canvas.width, canvas.height)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const on = rnd() < 0.42
    if (lit) { if (!on) continue; g.fillStyle = `rgb(255, ${warm}, …)` }
    else g.fillStyle = on ? '#3d4a52' : '#2a343b'
    g.fillRect(…окно…)
  }
  return new CanvasTexture(canvas)
}
```

Две текстуры с **одним зерном**: дневная (стена и тёмные окна) и «ночная» (чёрная, горят только
42% окон). Одинаковое зерно — горящие окна в ночной совпадают с окнами дневной.

```ts
const material = new MeshStandardMaterial({
  map: day,                 // как выглядит
  emissiveMap: lit,         // что светится само
  emissive: new Color('#ffb36b'),
  emissiveIntensity: 1.1,
})
```

`emissiveMap` — окна светятся **без** источников света. Сотня ламп в окнах — сотня источников, это
неподъёмно; карта свечения — бесплатно.

### 400 сосен одним вызовом

```ts
const crowns = new InstancedMesh(new ConeGeometry(1.6, 6, 7), material, COUNT)
const dummy = new Object3D()
while (placed < COUNT) {
  const x = …, z = …
  if (Math.abs(x) < 34 && z > -32) continue    // не в башни
  if (z > 12) continue                          // не в реку
  dummy.position.set(x, 1 + 3 * s, z)
  dummy.scale.setScalar(s)
  dummy.updateMatrix()
  crowns.setMatrixAt(placed, dummy.matrix)
  placed++
}
```

Одна геометрия конуса и **400 матриц** (положение + размер). Видеокарта рисует всё за один вызов.
`dummy` — вспомогательный объект, чтобы удобно посчитать матрицу. Деревья с подходящими координатами
пропускаются, пока не наберётся 400.

### Что под курсором

```ts
function pick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(towerMeshes, false)[0]
  …подсветить: emissiveIntensity 1.1 → 2.4…
  return hit?.object.userData ?? null
}
```

- Координаты курсора переводятся в систему WebGL: от −1 до 1, и **ось Y вверх** (в браузере вниз) —
  отсюда минус.
- Луч из камеры через эту точку; ищем пересечения **только с башнями** — сосны и землю
  проверять незачем.
- Подсветка — просто ярче светятся окна.
- `userData` у меша башни — `{ tower, free }`: данные для подсказки.

### Камера

```ts
render(time, progress, mx, my) {
  const angle = -0.35 + time * 0.02 + mx * 0.12 + progress * 0.6
  const radius = 125 - progress * 30
  camera.position.set(Math.sin(angle) * radius, 30 + progress * 18 - my * 6, Math.cos(angle) * radius + 10)
  camera.lookAt(0, 20 - progress * 4, -6)
  renderer.render(scene, camera)
}
```

Камера на окружности вокруг квартала: угол медленно растёт со временем, сдвигается мышью и
прокруткой; при прокрутке камера приближается (`radius` меньше) и поднимается. `lookAt` — всегда
смотрит в центр квартала.

### Уборка

```ts
dispose() {
  scene.traverse((obj) => {
    obj.geometry?.dispose()
    obj.material?.map?.dispose(); obj.material?.emissiveMap?.dispose(); obj.material?.dispose()
  })
  renderer.dispose()
  renderer.forceContextLoss()
  renderer.domElement.remove()
}
```

Геометрии, текстуры и материалы живут **в памяти видеокарты** — сборщик мусора JS их не
освобождает. Без `dispose` каждый уход со страницы оставлял бы мусор. У браузера ещё и лимит
WebGL-контекстов (обычно 16) — `forceContextLoss` возвращает контекст сразу.

## Что будет, если…

| Сделать | Что сломается |
| --- | --- |
| three.js в общем бандле | +600 КБ на каждой странице сайта |
| `ticker.add` без `onViewport` | кадры рисуются и за экраном — батарея и вентилятор |
| без `Math.min` для `dt` | после возврата на вкладку камера прыгает |
| 400 `Mesh` вместо `InstancedMesh` | заметно ниже FPS на слабых устройствах |
| без `dispose` | утечка памяти видеокарты |

## Проверьте себя

1. Почему в `pick` у Y минус?
2. Зачем две текстуры с одним зерном, а не одна?

<details>
<summary>Ответы</summary>

1. В браузере Y растёт вниз, в координатах WebGL — вверх.
2. `map` — как фасад выглядит при свете, `emissiveMap` — какие окна светятся сами. Одно зерно —
   светятся именно те окна, что нарисованы в `map`.
</details>
