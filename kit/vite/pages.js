/**
 * Vite-плагин: все .html в корне проекта — страницы сборки.
 *
 * Без него для многостраничного сайта нужно вручную перечислять страницы в
 * build.rolldownOptions.input. Забыли дописать новую — в dev она открывается,
 * а в dist/ её нет (классический баг «на проде 404»). Плагин находит
 * страницы сам.
 *
 * В корне учитываются только файлы .html (не папки partials/, public/).
 * Хотите вложенные страницы (/blog/post.html) — включите nested: true.
 * @module kit/vite/pages
 */
import { readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SKIP = new Set(['node_modules', 'dist', 'public', 'partials', 'src', 'kit', 'mocks', 'coverage', 'docs'])

/** Найти страницы: { 'index': '/abs/index.html', 'blog/post': … } */
export function findPages(root, { nested = false } = {}) {
  const pages = {}
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (nested && !SKIP.has(entry.name)) walk(full)
      } else if (entry.name.endsWith('.html')) {
        pages[relative(root, full).replace(/\.html$/, '')] = full
      }
    }
  }
  walk(root)
  return pages
}

export function pagesInput({ nested = false } = {}) {
  return {
    name: 'kit:pages',
    config(config) {
      const root = resolve(config.root ?? process.cwd())
      const pages = findPages(root, { nested })
      if (!Object.keys(pages).length) throw new Error(`[pages] в ${root} нет ни одной .html страницы`)
      return { build: { rolldownOptions: { input: pages } } }
    },
  }
}
