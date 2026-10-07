/**
 * Тесты Vite-плагинов (без запуска Vite: проверяем функции и хуки напрямую).
 * @vitest-environment node
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { markCurrentLinks, renderIncludes } from './html-include.js'
import { findPages, pagesInput } from './pages.js'
import { normalize, readBody } from './mock-api.js'
import { DEVTOOLS_MARKER, devtoolsGuard } from './devtools-guard.js'
import { kit } from './index.js'

const dir = mkdtempSync(join(tmpdir(), 'kit-vite-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const write = (name, content) => {
  mkdirSync(join(dir, name, '..'), { recursive: true })
  writeFileSync(join(dir, name), content)
}

describe('html-include', () => {
  it('вставляет кусок, подставляет переменные и значения по умолчанию', () => {
    write('p/head.html', '<title>{{ title }} — {{ site | Сайт }}</title>')
    expect(renderIncludes('<include src="head.html" title="Главная"></include>', { dir: join(dir, 'p') })).toBe(
      '<title>Главная — Сайт</title>',
    )
    expect(renderIncludes('<include src="head.html" title="A" />', { dir: join(dir, 'p') })).toBe(
      '<title>A — Сайт</title>',
    )
  })

  it('include и переменные внутри HTML-комментариев не трогаются', () => {
    const html = '<!-- пример: <include src="nope.html"></include> {{ x }} --><p>{{ x | ok }}</p>'
    expect(renderIncludes(html, { dir: join(dir, 'p') })).toBe(
      '<!-- пример: <include src="nope.html"></include> {{ x }} --><p>ok</p>',
    )
  })

  it('вложенные куски получают переменные родителя', () => {
    write('p/outer.html', '<header><include src="inner.html"></include></header>')
    write('p/inner.html', '<b>{{ name }}</b>')
    expect(renderIncludes('<include src="outer.html" name="X"></include>', { dir: join(dir, 'p') })).toBe(
      '<header><b>X</b></header>',
    )
  })

  it('понятные ошибки: нет файла, цикл, нет src, выход за папку; предупреждение о пустой переменной', () => {
    const o = { dir: join(dir, 'p'), page: 'index.html' }
    expect(() => renderIncludes('<include src="nope.html"></include>', o)).toThrow(/нет файла/)
    write('p/a.html', '<include src="b.html"></include>')
    write('p/b.html', '<include src="a.html"></include>')
    expect(() => renderIncludes('<include src="a.html"></include>', o)).toThrow(/цикл: a.html → b.html → a.html/)
    expect(() => renderIncludes('<include title="x"></include>', o)).toThrow(/нет атрибута src/)
    expect(() => renderIncludes('<include src="../secret.html"></include>', o)).toThrow(/выходит за папку/)
    const warn = vi.fn()
    renderIncludes('<include src="inner.html"></include>', { ...o, warn })
    expect(warn.mock.calls[0][0]).toContain('{{ name }}')
  })

  it('ссылки на текущую страницу получают aria-current', () => {
    const html = '<a href="/about.html">О нас</a><a href="/">Главная</a><a href="https://x.ru/about">x</a>'
    expect(markCurrentLinks(html, '/about.html')).toBe(
      '<a href="/about.html" aria-current="page">О нас</a><a href="/">Главная</a><a href="https://x.ru/about">x</a>',
    )
    expect(markCurrentLinks('<a class="l" href="index.html">Г</a>', '/')).toContain('aria-current="page"')
    expect(markCurrentLinks('<a href="/#faq">FAQ</a>', '/')).not.toContain('aria-current')
  })
})

describe('pages', () => {
  it('находит .html в корне, вложенные — по запросу', () => {
    write('site/index.html', '')
    write('site/about.html', '')
    write('site/partials/header.html', '')
    write('site/blog/post.html', '')
    expect(Object.keys(findPages(join(dir, 'site'))).sort()).toEqual(['about', 'index'])
    expect(Object.keys(findPages(join(dir, 'site'), { nested: true })).sort()).toEqual(['about', 'blog/post', 'index'])
    const config = pagesInput().config({ root: join(dir, 'site') })
    expect(Object.keys(config.build.rolldownOptions.input)).toContain('about')
    mkdirSync(join(dir, 'empty'))
    expect(() => pagesInput().config({ root: join(dir, 'empty') })).toThrow(/нет ни одной/)
  })
})

describe('mock-api', () => {
  const request = (body, type) =>
    Object.assign(Readable.from([Buffer.from(body)]), { headers: { 'content-type': type } })

  it('читает JSON, форму и multipart', async () => {
    expect(await readBody(request('{"a":1}', 'application/json'))).toEqual({ a: 1 })
    expect(await readBody(request('a=1&b=2', 'application/x-www-form-urlencoded'))).toEqual({ a: '1', b: '2' })
    const multipart = '--x\r\nContent-Disposition: form-data; name="phone"\r\n\r\n+7 912\r\n--x--'
    expect(await readBody(request(multipart, 'multipart/form-data; boundary=x'))).toEqual({ phone: '+7 912' })
    expect(await readBody(request('', 'application/json'))).toEqual({})
  })

  it('normalize: данные или полный ответ', () => {
    expect(normalize([1])).toEqual({ status: 200, body: [1], headers: {} })
    expect(normalize({ status: 422, body: { m: 1 } })).toEqual({ status: 422, body: { m: 1 }, headers: {} })
  })
})

describe('devtools-guard', () => {
  it('останавливает сборку, если метка dev-инструментов в бандле', () => {
    const plugin = devtoolsGuard()
    const error = vi.fn()
    plugin.generateBundle.call({ error }, {}, { 'a.js': { type: 'chunk', fileName: 'a.js', code: 'ok' } })
    expect(error).not.toHaveBeenCalled()
    plugin.generateBundle.call({ error }, {}, { 'b.js': { type: 'chunk', fileName: 'b.js', code: DEVTOOLS_MARKER } })
    expect(error.mock.calls[0][0]).toContain('b.js')
  })

  it('kit() собирает набор плагинов по настройкам', () => {
    expect(kit().map((p) => p.name)).toEqual([
      'kit:html',
      'kit:svg-sprite',
      'kit:pages',
      'kit:mock-api',
      'kit:devtools-guard',
    ])
    expect(kit({ include: false, icons: false, pages: false, mocks: false }).map((p) => p.name)).toEqual([
      'kit:devtools-guard',
    ])
  })
})
