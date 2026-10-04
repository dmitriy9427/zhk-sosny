/**
 * /plans/studio.svg, /plans/one.svg … — планировки типов квартир как файлы.
 * Astro собирает их при сборке (статические файлы): в карточках списка
 * квартир — <img src="/plans/two.svg">, браузер кеширует 4 файла на все карточки.
 */
import type { APIRoute, GetStaticPaths } from 'astro'
import { PLANS, planSvg } from '../../lib/plan'
import type { Layout } from '../../data/flats'

export const getStaticPaths: GetStaticPaths = () => Object.keys(PLANS).map((layout) => ({ params: { layout } }))

export const GET: APIRoute = ({ params }) =>
  new Response(planSvg(params.layout as Layout), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } })
