/**
 * Тесты SCSS: компилируется ли кит, работают ли настройки и функции,
 * совпадают ли брейкпоинты в CSS и JS.
 * Окружение node: sass — инструмент сборки, браузер ему не нужен.
 * @vitest-environment node
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as sass from 'sass'
import { DEFAULT_BREAKPOINTS } from '../js/core/env.js'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const compile = (source) => sass.compileString(source, { loadPaths: [ROOT], style: 'expanded' }).css

describe('kit/scss', () => {
  it('компилируется целиком без предупреждений об устаревшем синтаксисе', () => {
    const warnings = []
    const css = sass.compileString("@use 'kit/scss';", {
      loadPaths: [ROOT],
      logger: { warn: (message) => warnings.push(message) },
    }).css
    expect(css).toContain('--color-accent')
    expect(css).toContain('.accordion__panel')
    expect(warnings).toEqual([])
  })

  it('брейкпоинты в CSS совпадают с запасными значениями в JS (env.js)', () => {
    const css = compile("@use 'kit/scss/base/root';")
    for (const [name, value] of Object.entries(DEFAULT_BREAKPOINTS)) {
      expect(css).toContain(`--bp-${name}: ${value}px`)
    }
  })

  it('настройки проекта сливаются с настройками по умолчанию', () => {
    const css = compile(`
      @use 'kit/scss/abstracts' with ($colors: ('accent': #ff0000), $breakpoints: ('md': 800px));
      @use 'kit/scss/base/root';
    `)
    expect(css).toContain('--color-accent: #ff0000')
    expect(css).toContain('--color-bg: #fff') // остальные цвета на месте
    expect(css).toContain('--bp-md: 800px')
    expect(css).toContain('--bp-lg: 1024px')
  })

  it('функции rem, fluid, z и миксины up/down/hover', () => {
    const css = compile(`
      @use 'kit/scss/abstracts' as *;
      .a { width: rem(24px); height: rem(32); z-index: z('header'); font-size: fluid(16px, 32px); }
      .b { @include up('md') { color: red; } @include down('md') { color: blue; } @include hover { color: green; } }
    `)
    expect(css).toContain('width: 1.5rem')
    expect(css).toContain('height: 2rem')
    expect(css).toContain('z-index: 200')
    expect(css).toMatch(/font-size: clamp\(1rem, .+vw, 2rem\)/)
    expect(css).toContain('@media (min-width: 768px)')
    expect(css).toContain('@media (max-width: 767.98px)')
    expect(css).toContain('@media (hover: hover) and (pointer: fine)')
  })

  it('опечатки дают понятные ошибки, а не молчаливый пустой CSS', () => {
    expect(() => compile("@use 'kit/scss/abstracts' as *; .a { color: color('acent'); }")).toThrow(/Нет цвета «acent»/)
    expect(() => compile("@use 'kit/scss/abstracts' as *; .a { z-index: z('modal'); }")).toThrow(/Нет слоя «modal»/)
    expect(() => compile("@use 'kit/scss/abstracts' as *; .a { @include up('tablet') { color: red; } }")).toThrow(
      /Нет брейкпоинта/,
    )
    expect(() => compile("@use 'kit/scss/abstracts' as *; .a { width: rem(2em); }")).toThrow(/ждёт пиксели/)
    expect(() => compile("@use 'kit/scss/abstracts' as *; .a { width: fluid(1px, 2px, 900px, 400px); }")).toThrow(
      /меньше/,
    )
  })

  it('настройка после загрузки — та самая ошибка из troubleshooting', () => {
    expect(() =>
      compile(`
        @use 'kit/scss/base/root';
        @use 'kit/scss/abstracts' with ($colors: ('accent': red));
      `),
    ).toThrow(/already loaded/)
  })
})
