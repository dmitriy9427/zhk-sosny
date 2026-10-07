#!/usr/bin/env node
/**
 * Создать заготовку компонента, модуля или страницы — с правильной структурой
 * и комментариями, чтобы не копировать руками и не забывать файлы.
 *
 *   npm run new -- component card            src/components/card/ — card.html + card.scss
 *   npm run new -- component price-calc --js  …+ price-calc.js + price-calc.test.js
 *   npm run new -- module copy-link          src/modules/copy-link/ — index.js + тест
 *   npm run new -- page about "О компании"   about.html (шапка, подвал, main)
 *   npm run new -- plugin metrika            src/plugins/metrika.js — код на весь сайт, запускается сам
 *
 * --root <папка> — корень проекта (по умолчанию текущая папка).
 * Ничего не перезаписывает: если файл уже есть — ошибка.
 * @module kit/cli/new
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process' // явно: файл проверяется линтером и в старых проектах
import { fileURLToPath } from 'node:url'

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())

export const templates = {
  componentHtml: (name, js) => `<!--
  ${name} — описание: что это и где используется.
    <x-${name} title="Заголовок">Содержимое</x-${name}>
  Props: title — заголовок.${js ? `\n  JS: ${name}.js — data-module="${name}" ставится сам.` : ''}
  Синтаксис шаблонов: docs/components.md
-->
<div class="${name}">
  <h3 x-if="title" class="${name}__title">{{ title }}</h3>
  <div class="${name}__body"><slot /></div>
</div>
`,
  componentScss: (name) => `// ${name}: стили компонента. Подключаются сами (src/main.js → import.meta.glob).
@use 'abstracts' as *;

.${name} {
  display: grid;
  gap: space(3);
}

.${name}__title {
  font-size: rem(20px);
}
`,
  moduleJs: (name, { component }) => `/**
 * ${name} — что делает модуль.
 *${component ? `\n * Компонент: src/components/${name}/${name}.html, data-module ставится сам.` : `\n *   <div data-module="${name}" data-${name}-option="значение">…</div>`}
 *
 * Шаблон любого модуля (docs/modules.md → «Свой модуль»):
 *   1. DEFAULTS — все настройки со значениями по умолчанию (тип важен!);
 *   2. readOptions — настройки из data-${name}-* атрибутов;
 *   3. createDisposer — всё, что включили, сразу кладём «на выключение»;
 *   4. return { …методы, destroy } — API для других модулей:
 *      ctx.modules.get(el, '${name}').метод()
 */
import { createDisposer } from 'kit/js/core/lifecycle.js'
import { readOptions } from 'kit/js/core/options.js'

const DEFAULTS = {
  option: 'значение',
}

export default function ${camel(name)}(el, ctx = {}) {
  const options = readOptions(el, '${name}', DEFAULTS, ctx.options)
  const d = createDisposer()

  d.listen(el, 'click', () => {
    el.classList.toggle('is-active')
    ctx.bus?.emit('${name}:toggle', el.classList.contains('is-active'))
  })

  return {
    get options() {
      return options
    },
    destroy: d.dispose,
  }
}
`,
  moduleTest: (name, file) => `import { describe, expect, it, vi } from 'vitest'
import ${camel(name)} from './${file}'
import { createCtx, html } from '@test/helpers.js'

describe('${name}', () => {
  it('переключает класс и шлёт событие; destroy снимает обработчики', () => {
    const ctx = createCtx()
    const toggled = vi.fn()
    ctx.bus.on('${name}:toggle', toggled)
    const el = html('<div data-${name}-option="другое"></div>')
    const api = ${camel(name)}(el, ctx)
    expect(api.options.option).toBe('другое')
    el.click()
    expect(el.classList.contains('is-active')).toBe(true)
    expect(toggled).toHaveBeenCalledWith(true)
    api.destroy()
    el.click()
    expect(toggled).toHaveBeenCalledTimes(1)
  })
})
`,
  plugin: (name) => `/**
 * ${name} — плагин сайта: запускается ОДИН раз при старте, до модулей
 * (src/main.js → pluginsFromGlob). Порядок плагинов — по имени файла.
 * Получает { ctx, modules }: шину событий и доступ к модулям.
 */
export default function ${camel(name.replace(/^\d+-/, ''))}({ ctx }) {
  const off = ctx.bus.on('app:ready', () => {
    // сайт запущен — можно делать что-то для всех страниц
  })
  // Вернуть функцию уборки (необязательно).
  return off
}
`,
  page: (name, title) => `<!doctype html>
<html lang="ru">
  <head>
    <x-site-head title="${title}" />
  </head>
  <body>
    <x-site-header />

    <main id="main" data-module="reveal">
      <section class="section">
        <div class="container stack">
          <x-section-head title="${title}" />
          <p data-reveal>Содержимое страницы ${name}.html</p>
        </div>
      </section>
    </main>

    <x-site-footer />
  </body>
</html>
`,
}

/**
 * @param {{ kind: string, name: string, root?: string, js?: boolean, title?: string, log?: (s: string) => void }} o
 * @returns {string[]} Созданные файлы.
 */
export function generate({ kind, name, root = '.', js = false, title, log = console.info }) {
  // У плагина может быть числовой префикс порядка: 03-metrika.
  const checked = kind === 'plugin' ? (name ?? '').replace(/^\d+-/, '') : name
  if (!NAME.test(checked ?? ''))
    throw new Error(`Имя «${name}» не подходит: латиница в нижнем регистре и дефисы (price-calc)`)
  const base = resolve(root)
  /** @type {[string, string][]} */
  let files
  if (kind === 'component') {
    const dir = join(base, 'src/components', name)
    files = [
      [join(dir, `${name}.html`), templates.componentHtml(name, js)],
      [join(dir, `${name}.scss`), templates.componentScss(name)],
    ]
    if (js)
      files.push(
        [join(dir, `${name}.js`), templates.moduleJs(name, { component: true })],
        [join(dir, `${name}.test.js`), templates.moduleTest(name, `${name}.js`)],
      )
  } else if (kind === 'module') {
    const dir = join(base, 'src/modules', name)
    files = [
      [join(dir, 'index.js'), templates.moduleJs(name, { component: false })],
      [join(dir, `${name}.test.js`), templates.moduleTest(name, 'index.js')],
    ]
  } else if (kind === 'plugin') {
    files = [[join(base, 'src/plugins', `${name}.js`), templates.plugin(name)]]
  } else if (kind === 'page') {
    files = [[join(base, `${name}.html`), templates.page(name, title ?? name)]]
  } else {
    throw new Error(`Что создать: component, module, plugin или page (а не «${kind}»)`)
  }
  for (const [file] of files)
    if (existsSync(file)) throw new Error(`Уже есть ${relative(base, file)} — не перезаписываю`)
  for (const [file, content] of files) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
    log(`  + ${relative(base, file)}`)
  }
  const hint = {
    component: `Вставьте на страницу: <x-${name} title="…">…</x-${name}>`,
    module: `В разметке: <div data-module="${name}">…</div>`,
    page: `Откройте http://localhost:5173/${name}.html`,
    plugin: 'Подключится сам при следующем запуске страницы',
  }[kind]
  log(`✓ Готово. ${hint}`)
  return files.map(([file]) => file)
}

function main() {
  const argv = process.argv.slice(2)
  const flag = (n) => argv.includes(`--${n}`)
  const value = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--root')
  const [kind, name, title] = positional
  if (!kind || flag('help')) {
    console.info(
      'npm run new -- component <имя> [--js] | module <имя> | plugin <имя> | page <имя> ["Заголовок"]   [--root папка]',
    )
    return
  }
  generate({ kind, name, title, js: flag('js'), root: value('root') ?? '.' })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exit(1)
  }
}
