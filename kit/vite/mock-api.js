/**
 * Vite-плагин: фейковый API для разработки, пока нет бэкенда.
 *
 *   // mocks/callback.js  → отвечает на /api/callback
 *   export function POST({ body }) {
 *     if (!body.phone) return { status: 422, body: { message: 'Нет телефона' } }
 *     return { body: { message: 'Заявка принята' } }
 *   }
 *   export const GET = () => ({ body: [{ id: 1, title: 'Новость' }] })
 *
 * ─── Правила ─────────────────────────────────────────────────────────────────
 * - путь: /api/news/latest → mocks/news/latest.js;
 * - экспорт по методу (GET, POST, PUT, PATCH, DELETE) или default — на всё;
 * - вернуть можно { status, body, headers } или просто данные (тогда 200);
 * - query (?page=2) — в аргументе { query }, тело JSON/формы — в { body };
 * - задержка ответа (delay) имитирует медленную сеть: видно спиннеры, ловятся
 *   гонки и двойные клики;
 * - файл мока можно править без перезапуска — подхватится сразу.
 *
 * ─── Только в разработке ───────────────────────────────────────────────────
 * apply: 'serve' — в сборку плагин не попадает вообще. На проде запросы
 * идут на настоящий бэкенд (адрес — переменная окружения, см. docs/api.md).
 * @module kit/vite/mock-api
 */
import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'

/** Прочитать тело запроса: JSON или форма → объект; multipart — сырое. */
export async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  const type = req.headers['content-type'] ?? ''
  if (!raw) return {}
  if (type.includes('application/json')) {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw))
  if (type.includes('multipart/form-data')) {
    // Простейший разбор полей формы (без файлов) — для моков этого хватает.
    const body = {}
    for (const m of raw.matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g)) body[m[1]] = m[2]
    return body
  }
  return { raw }
}

/** Привести ответ мока к { status, body, headers }. */
export function normalize(result) {
  if (result && typeof result === 'object' && ('body' in result || 'status' in result)) {
    return { status: result.status ?? 200, body: result.body ?? null, headers: result.headers ?? {} }
  }
  return { status: 200, body: result ?? null, headers: {} }
}

/**
 * @param {{ dir?: string, prefix?: string, delay?: number }} [o]
 */
export function mockApi({ dir = 'mocks', prefix = '/api', delay = 400 } = {}) {
  return {
    name: 'kit:mock-api',
    apply: 'serve',
    configureServer(server) {
      const root = resolve(server.config.root, dir)
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (!url.pathname.startsWith(prefix + '/')) return next()
        const name = url.pathname.slice(prefix.length + 1).replace(/\/$/, '')
        const file = resolve(root, `${name}.js`)
        const send = (status, body, headers = {}) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
          res.end(JSON.stringify(body))
        }
        if (!file.startsWith(root + sep) || !existsSync(file)) {
          return send(404, { message: `[mock-api] нет файла ${dir}/${name}.js для ${req.method} ${url.pathname}` })
        }
        try {
          // ssrLoadModule сам сбрасывает кеш при изменении файла — правки видны сразу.
          const mod = await server.ssrLoadModule(file)
          const handler = mod[req.method] ?? mod.default
          if (!handler) return send(405, { message: `[mock-api] в ${dir}/${name}.js нет обработчика ${req.method}` })
          const body = await readBody(req)
          const result =
            typeof handler === 'function'
              ? await handler({ body, query: Object.fromEntries(url.searchParams), req })
              : handler
          const { status, body: out, headers } = normalize(result)
          if (delay) await new Promise((r) => setTimeout(r, delay))
          send(status, out, headers)
        } catch (error) {
          server.config.logger.error(`[mock-api] ${name}: ${error.message}`)
          send(500, { message: `[mock-api] ошибка в моке ${name}: ${error.message}` })
        }
      })
    },
  }
}
