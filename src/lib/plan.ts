/**
 * Планировки квартир в SVG — генерируются кодом, без файлов от архитектора.
 * В реальном проекте планировки дают PDF/SVG из CRM; здесь — схемы по типу
 * квартиры: стены, комнаты с подписями и площадями, окна, двери.
 *
 * Размеры в «клетках» (1 клетка ≈ 10 см) — SVG масштабируется сам.
 */
import type { Layout } from '../data/flats'

interface Room {
  name: string
  x: number
  y: number
  w: number
  h: number
  /** Окна на внешних стенах: 'top' | 'left' | 'right' | 'bottom'. */
  windows?: ('top' | 'left' | 'right' | 'bottom')[]
  wet?: boolean
}

interface Plan {
  width: number
  height: number
  rooms: Room[]
}

export const PLANS: Record<Layout, Plan> = {
  studio: {
    width: 60,
    height: 48,
    rooms: [
      { name: 'Кухня-гостиная', x: 0, y: 0, w: 60, h: 30, windows: ['top'] },
      { name: 'С/у', x: 0, y: 30, w: 22, h: 18, wet: true },
      { name: 'Прихожая', x: 22, y: 30, w: 38, h: 18 },
    ],
  },
  one: {
    width: 72,
    height: 56,
    rooms: [
      { name: 'Комната', x: 0, y: 0, w: 40, h: 32, windows: ['top'] },
      { name: 'Кухня', x: 40, y: 0, w: 32, h: 32, windows: ['top', 'right'] },
      { name: 'С/у', x: 0, y: 32, w: 22, h: 24, wet: true },
      { name: 'Прихожая', x: 22, y: 32, w: 50, h: 24 },
    ],
  },
  two: {
    width: 92,
    height: 62,
    rooms: [
      { name: 'Спальня', x: 0, y: 0, w: 36, h: 34, windows: ['top', 'left'] },
      { name: 'Кухня-гостиная', x: 36, y: 0, w: 56, h: 34, windows: ['top'] },
      { name: 'Детская', x: 0, y: 34, w: 36, h: 28, windows: ['left'] },
      { name: 'С/у', x: 36, y: 34, w: 20, h: 28, wet: true },
      { name: 'Прихожая', x: 56, y: 34, w: 36, h: 28 },
    ],
  },
  three: {
    width: 112,
    height: 66,
    rooms: [
      { name: 'Спальня', x: 0, y: 0, w: 34, h: 36, windows: ['top', 'left'] },
      { name: 'Кухня-гостиная', x: 34, y: 0, w: 46, h: 36, windows: ['top'] },
      { name: 'Кабинет', x: 80, y: 0, w: 32, h: 36, windows: ['top', 'right'] },
      { name: 'Детская', x: 0, y: 36, w: 34, h: 30, windows: ['left'] },
      { name: 'С/у', x: 34, y: 36, w: 18, h: 30, wet: true },
      { name: 'Ванная', x: 52, y: 36, w: 18, h: 30, wet: true },
      { name: 'Прихожая', x: 70, y: 36, w: 42, h: 30 },
    ],
  },
}

/** Площадь комнаты, м² (клетка 10 см → 100 клеток = 1 м²), чуть «реальнее» за счёт масштаба плана. */
export const roomArea = (room: Room, scale = 1) => Math.round(((room.w * room.h) / 100) * scale * 10) / 10

/**
 * SVG-строка планировки.
 * @param totalArea настоящая площадь квартиры — площади комнат масштабируются под неё.
 */
export function planSvg(layout: Layout, { totalArea, title = '' }: { totalArea?: number; title?: string } = {}) {
  const plan = PLANS[layout]
  const raw = plan.rooms.reduce((sum, r) => sum + (r.w * r.h) / 100, 0)
  const scale = totalArea ? totalArea / raw : 1
  const pad = 6
  const W = plan.width + pad * 2
  const H = plan.height + pad * 2
  const wall = 1.6
  const parts: string[] = []
  for (const room of plan.rooms) {
    const x = room.x + pad
    const y = room.y + pad
    parts.push(
      `<rect class="plan__room${room.wet ? ' plan__room--wet' : ''}" x="${x}" y="${y}" width="${room.w}" height="${room.h}"/>`,
    )
    for (const side of room.windows ?? []) {
      const horizontal = side === 'top' || side === 'bottom'
      const len = (horizontal ? room.w : room.h) * 0.45
      const wx = horizontal ? x + (room.w - len) / 2 : side === 'left' ? x - wall / 2 : x + room.w - wall / 2
      const wy = horizontal ? (side === 'top' ? y - wall / 2 : y + room.h - wall / 2) : y + (room.h - len) / 2
      parts.push(
        `<rect class="plan__window" x="${wx}" y="${wy}" width="${horizontal ? len : wall}" height="${horizontal ? wall : len}"/>`,
      )
    }
    const cx = x + room.w / 2
    const cy = y + room.h / 2
    const small = room.w < 24 || room.h < 22
    parts.push(
      `<text class="plan__label" x="${cx}" y="${cy - (small ? 0.5 : 1.5)}" font-size="${small ? 2.6 : 3.2}">${room.name}</text>`,
      `<text class="plan__area" x="${cx}" y="${cy + (small ? 3 : 4)}" font-size="${small ? 2.4 : 2.8}">${roomArea(room, scale).toLocaleString('ru-RU')} м²</text>`,
    )
  }
  // Внешний контур — толстая стена.
  parts.push(`<rect class="plan__outline" x="${pad}" y="${pad}" width="${plan.width}" height="${plan.height}"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="plan" role="img" aria-label="${title || 'Планировка'}">
<style>
.plan__room{fill:#f6f1e8;stroke:#2b3a2f;stroke-width:.6}
.plan__room--wet{fill:#e3ece9}
.plan__outline{fill:none;stroke:#1f2b22;stroke-width:${wall}}
.plan__window{fill:#9cc3d5}
.plan__label{fill:#1f2b22;font-family:system-ui,sans-serif;font-weight:600;text-anchor:middle}
.plan__area{fill:#5f6b62;font-family:system-ui,sans-serif;text-anchor:middle}
</style>
${parts.join('\n')}
</svg>`
}
