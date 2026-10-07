/** @vitest-environment node */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { generate } from './new.mjs'

const root = mkdtempSync(join(tmpdir(), 'kit-new-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))
const quiet = { root, log: () => {} }

describe('npm run new', () => {
  it('component: html + scss, с --js ещё модуль и тест', () => {
    generate({ kind: 'component', name: 'promo-card', js: true, ...quiet })
    const dir = join(root, 'src/components/promo-card')
    for (const f of ['promo-card.html', 'promo-card.scss', 'promo-card.js', 'promo-card.test.js'])
      expect(existsSync(join(dir, f))).toBe(true)
    expect(readFileSync(join(dir, 'promo-card.js'), 'utf8')).toContain(
      'export default function promoCard(el, ctx = {})',
    )
    expect(readFileSync(join(dir, 'promo-card.scss'), 'utf8')).toContain("@use 'abstracts' as *;")
  })

  it('module и page', () => {
    generate({ kind: 'module', name: 'copy-link', ...quiet })
    expect(existsSync(join(root, 'src/modules/copy-link/index.js'))).toBe(true)
    generate({ kind: 'page', name: 'about', title: 'О нас', ...quiet })
    expect(readFileSync(join(root, 'about.html'), 'utf8')).toContain('<x-site-head title="О нас" />')
    generate({ kind: 'plugin', name: '03-metrika', ...quiet })
    expect(readFileSync(join(root, 'src/plugins/03-metrika.js'), 'utf8')).toContain('export default function')
  })

  it('не перезаписывает и проверяет имя', () => {
    expect(() => generate({ kind: 'module', name: 'copy-link', ...quiet })).toThrow(/Уже есть/)
    expect(() => generate({ kind: 'component', name: 'Card', ...quiet })).toThrow(/не подходит/)
    expect(() => generate({ kind: 'widget', name: 'x', ...quiet })).toThrow(/component, module, plugin или page/)
  })
})
