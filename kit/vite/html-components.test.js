/**
 * Тесты HTML-компонентов и SVG-спрайта — заодно живая шпаргалка по синтаксису.
 * @vitest-environment node
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { escapeHtml, loadData, renderHtml } from './html-components.js'
import { svgSprite, toSymbol, usedIcons } from './svg-sprite.js'

const dir = mkdtempSync(join(tmpdir(), 'kit-html-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const write = (name, content) => {
  mkdirSync(join(dir, name, '..'), { recursive: true })
  writeFileSync(join(dir, name), content)
}
const components = [join(dir, 'components')]
/** Отрисовать и убрать пробелы между тегами — сравнивать проще. */
const render = (html, o = {}) =>
  renderHtml(html, { components, ...o })
    .replace(/>\s+</g, '><')
    .trim()

write('components/card/card.html', '<!-- документация --><article class="card"><h3>{{ title }}</h3><slot /></article>')
write('components/badge/badge.html', '<span :class="[\'badge\', tone && \'badge--\' + tone]">{{ text ?? "—" }}</span>')
write('components/like/like.html', '<button class="like">♥</button>')
write('components/like/like.js', 'export default () => {}')
write(
  'components/panel/panel.html',
  '<section class="panel"><header x-if="$slots.head"><slot name="head" /></header><slot>пусто</slot></section>',
)

describe('выражения и директивы', () => {
  it('{{ }} экранирует, {{{ }}} — нет; готовые сущности не портит', () => {
    const globals = { html: '<b>x</b>', name: 'A & B' }
    expect(render('<p>{{ html }}|{{{ html }}}|{{ name }}|A &amp; B</p>', { globals })).toBe(
      '<p>&lt;b&gt;x&lt;/b&gt;|<b>x</b>|A &amp; B|A &amp; B</p>',
    )
    expect(escapeHtml('&nbsp;&#8212;"')).toBe('&nbsp;&#8212;&quot;')
  })

  it('выражения — обычный JS; неизвестное имя — пусто, а не ошибка', () => {
    expect(
      render('<p>{{ price.toLocaleString("ru-RU") }} {{ nope }} {{ 2 + 2 }}</p>', { globals: { price: 1000 } }),
    ).toBe(`<p>${(1000).toLocaleString('ru-RU')}  4</p>`)
  })

  it('x-for: массив, индекс, число, объект; x-if внутри x-for — фильтр', () => {
    const globals = { items: ['a', 'b', 'c'], prices: { s: 1, m: 2 } }
    expect(render('<i x-for="(x, i) of items">{{ i }}{{ x }}</i>', { globals })).toBe('<i>0a</i><i>1b</i><i>2c</i>')
    expect(render('<b x-for="n of 3">{{ n }}</b>', { globals })).toBe('<b>1</b><b>2</b><b>3</b>')
    expect(render('<b x-for="[k, v] of prices">{{ k }}={{ v }}</b>', { globals })).toBe('<b>s=1</b><b>m=2</b>')
    expect(render('<b x-for="({ t }, i) of rows">{{ i }}{{ t }}</b>', { globals: { rows: [{ t: 'x' }] } })).toBe(
      '<b>0x</b>',
    )
    expect(render('<b x-for="x of items" x-if="x !== \'b\'">{{ x }}</b>', { globals })).toBe('<b>a</b><b>c</b>')
  })

  it('x-if / x-else и <template> без обёртки', () => {
    expect(render('<a x-if="ok">да</a><b x-else>нет</b>', { globals: { ok: false } })).toBe('<b>нет</b>')
    expect(render('<template x-if="true"><i>1</i><i>2</i></template>')).toBe('<i>1</i><i>2</i>')
    expect(() => render('<b x-else>?</b>')).toThrow(/x-else без x-if/)
  })

  it(':attr — выражение: false/null убирают атрибут, true — без значения, class/style — объектом', () => {
    const html =
      '<a :href="url" :hidden="false" :download="true" class="a" :class="{ on: active }" :style="{ \'--x\': 1 }">x</a>'
    expect(render(html, { globals: { url: '/a?b=1&c=2', active: true } })).toBe(
      '<a class="a on" href="/a?b=1&amp;c=2" download style="--x: 1">x</a>',
    )
  })

  it('x-pre: содержимое как есть (примеры кода)', () => {
    expect(render('<pre x-pre>{{ title }} <x-card /></pre>')).toBe('<pre>{{ title }} <x-card></x-card></pre>')
  })

  it('понятная ошибка в выражении', () => {
    expect(() => render('<p>{{ a. }}</p>', { page: '/about.html' })).toThrow(/\/about\.html: ошибка синтаксиса в «a\.»/)
  })
})

describe('компоненты', () => {
  it('props, слот, документация-комментарий не копируется', () => {
    expect(render('<x-card title="Привет"><p>текст</p></x-card>')).toBe(
      '<article class="card"><h3>Привет</h3><p>текст</p></article>',
    )
  })

  it(':prop — значение из данных; prop без значения — true; kebab → camelCase', () => {
    write('components/flags/flags.html', '<i>{{ big }} {{ perPage * 2 }}</i>')
    expect(render('<x-flags big :per-page="n" />', { globals: { n: 5 } })).toBe('<i>true 10</i>')
  })

  it('class, id, data-*, aria-* переходят на корень; data-module ставится, если есть .js', () => {
    expect(render('<x-badge text="new" tone="ok" class="mt" id="b" data-x="1" aria-label="L" />')).toBe(
      '<span class="badge badge--ok mt" id="b" data-x="1" aria-label="L">new</span>',
    )
    expect(render('<x-like data-module="magnetic" />')).toBe(
      '<button class="like" data-module="magnetic like">♥</button>',
    )
  })

  it('именованные слоты, запасное содержимое, $slots', () => {
    expect(render('<x-panel />')).toBe('<section class="panel">пусто</section>')
    expect(render('<x-panel><template slot="head"><h2>Шапка</h2></template><p>Тело</p></x-panel>')).toBe(
      '<section class="panel"><header><h2>Шапка</h2></header><p>Тело</p></section>',
    )
  })

  it('слот видит переменные ВЫЗОВА, компонент — только свои props и данные', () => {
    const globals = { site: 'S' }
    expect(render('<i x-for="u of [\'аня\']"><x-card title="T">{{ u }} {{ site }}</x-card></i>', { globals })).toBe(
      '<i><article class="card"><h3>T</h3>аня S</article></i>',
    )
  })

  it('цикл компонентов из данных', () => {
    const globals = { list: [{ t: 'A' }, { t: 'B' }] }
    expect(render('<x-card x-for="c of list" :title="c.t" />', { globals })).toBe(
      '<article class="card"><h3>A</h3></article><article class="card"><h3>B</h3></article>',
    )
  })

  it('нет компонента — ошибка со списком; рекурсия ограничена', () => {
    expect(() => render('<x-nope />')).toThrow(/нет компонента <x-nope>.*Есть: .*x-card/)
    write('components/loop/loop.html', '<i><x-loop /></i>')
    expect(() => render('<x-loop />')).toThrow(/слишком глубокая вложенность/)
  })

  it('предупреждение о незаданном {{ prop }} внутри компонента', () => {
    const warn = vi.fn()
    render('<x-card />', { warn })
    expect(warn.mock.calls[0][0]).toMatch(/x-card: нет значения для \{\{ title \}\}/)
  })

  it('<doctype>, void-элементы, svg и пустые атрибуты сохраняются', () => {
    const html =
      '<!doctype html><html><body><img src="a.png" alt=""><input disabled><svg viewBox="0 0 1 1"><use href="#i"></use></svg></body></html>'
    expect(renderHtml(html, { components })).toBe(
      '<!doctype html><html><body><img src="a.png" alt><input disabled><svg viewBox="0 0 1 1"><use href="#i"/></svg></body></html>',
    )
  })
})

describe('данные', () => {
  it('json и js из папки → переменные по имени файла', async () => {
    write('data/site-info.json', '{"name":"Мята"}')
    write('data/nav.js', 'export default [{ href: "/" }]')
    const data = await loadData(join(dir, 'data'))
    expect(data).toEqual({ siteInfo: { name: 'Мята' }, nav: [{ href: '/' }] })
    write('data/broken.json', '{')
    await expect(loadData(join(dir, 'data'))).rejects.toThrow(/ошибка в .*broken\.json/)
  })
})

describe('svg-sprite', () => {
  it('toSymbol: viewBox, цвета → currentColor, мусор экспорта убран', () => {
    const svg =
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#111"><title>x</title><path fill="#F00" d="M0 0"/></svg>'
    expect(toSymbol(svg, 'icon-x')).toBe(
      '<symbol id="icon-x" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path fill="currentColor" d="M0 0"/></symbol>',
    )
    expect(toSymbol(svg, 'icon-x', { keepColors: true })).toContain('fill="#F00"')
  })

  it('в страницу попадают только используемые иконки; неизвестная — предупреждение', () => {
    write('icons/a.svg', '<svg viewBox="0 0 1 1"><path d="M0"/></svg>')
    write('icons/logo.color.svg', '<svg viewBox="0 0 2 2"><path fill="red" d="M0"/></svg>')
    write('icons/b.svg', '<svg viewBox="0 0 1 1"><path d="M1"/></svg>')
    const plugin = svgSprite({ dir: join(dir, 'icons') })
    plugin.configResolved({ root: '/' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = plugin.transformIndexHtml.handler(
      '<body><svg><use href="#icon-a"></use></svg><svg><use href="#icon-logo"></use></svg><use href="#icon-zz"></use></body>',
      { path: '/' },
    )
    expect(out).toContain('<symbol id="icon-a"')
    expect(out).toContain('fill="red"') // .color.svg — цвета сохранены
    expect(out).not.toContain('icon-b"')
    expect(warn.mock.calls[0][0]).toMatch(/нет иконки «zz».*Есть: a, b, logo/)
    expect([...usedIcons('<use href="#icon-x"></use><use xlink:href="#icon-y">')]).toEqual(['x', 'y'])
  })
})
