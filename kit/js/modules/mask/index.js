/**
 * Маска на отдельном поле (вне <form data-module="form">, где маски включаются сами).
 *
 *   <input data-module="mask" data-mask="phone">
 *   <input data-module="mask" data-mask-pattern="AA 999999">
 *
 * Список масок и как они работают — kit/js/form/mask.js.
 * @module kit/modules/mask
 */
import { attachMask } from '../../form/mask.js'

export default function mask(input) {
  const handle = attachMask(input)
  if (!handle) throw new Error('[kit] mask: укажите data-mask="phone|date|…" или data-mask-pattern')
  return { mask: handle.mask, destroy: handle.destroy }
}
