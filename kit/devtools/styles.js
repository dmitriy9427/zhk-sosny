/**
 * Стили dev-панели — строками, чтобы не требовать сборщик CSS и не попадать
 * в стили проекта. PANEL_CSS живёт внутри Shadow DOM панели, PAGE_CSS —
 * то немногое, что должно действовать на саму страницу (сетка, контуры).
 * @module kit/devtools/styles
 */

export const PAGE_CSS = `
.kit-dev-outline *:not([data-kit-devtools], [data-kit-devtools] *) { outline: 1px solid rgb(255 0 128 / 35%) !important; }
.kit-dev-grid { position: fixed; inset: 0; z-index: 8999; pointer-events: none; }
.kit-dev-grid > div {
  display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: var(--grid-gap, 24px);
  height: 100%; width: 100%; max-width: var(--container-max, 1280px); margin-inline: auto; padding-inline: var(--container-padding, 16px);
  box-sizing: border-box;
}
.kit-dev-grid span { background: rgb(255 0 80 / 8%); border-inline: 1px solid rgb(255 0 80 / 25%); }
.kit-dev-mockup { position: absolute; top: 0; left: 50%; z-index: 8998; max-width: none; transform: translateX(-50%); pointer-events: none; }
[data-kit-highlight] { outline: 3px solid #ff2d75 !important; outline-offset: 2px !important; box-shadow: 0 0 0 9999px rgb(0 0 0 / 35%) !important; }
`

export const PANEL_CSS = `
:host { all: initial; font: 12px/1.4 ui-monospace, Menlo, monospace; color: #e8eaf0; }
.fab { position: fixed; left: 12px; bottom: 12px; z-index: 9001; width: 36px; height: 36px; border: 0; border-radius: 50%;
  background: #1d2130; color: #9fb0ff; font-size: 18px; cursor: pointer; box-shadow: 0 4px 14px rgb(0 0 0 / 30%); opacity: .6; }
.fab:hover { opacity: 1; }
.panel { position: fixed; left: 12px; bottom: 56px; z-index: 9001; width: 300px; max-height: 70vh; overflow: auto;
  padding: 12px; background: #151822f0; border: 1px solid #2b3145; border-radius: 12px; box-shadow: 0 10px 40px rgb(0 0 0 / 40%); }
.panel[hidden] { display: none; }
header { margin-bottom: 8px; font-weight: 700; color: #9fb0ff; }
header small { color: #6b7389; font-weight: 400; }
.tools { display: flex; flex-wrap: wrap; gap: 6px; }
.tools label { display: flex; gap: 4px; align-items: center; width: calc(50% - 3px); cursor: pointer; }
.tools button, .mockup-controls { font: inherit; }
.tools button { flex: 1; padding: 5px 6px; color: #e8eaf0; background: #232839; border: 1px solid #343b52; border-radius: 6px; cursor: pointer; }
.tools button:hover { background: #2d3348; }
.mockup-controls { display: grid; gap: 4px; margin-top: 8px; padding: 8px; background: #1d2130; border-radius: 8px; }
.mockup-controls input[type=file] { max-width: 100%; color: inherit; }
.output h4 { margin: 10px 0 4px; font-size: 12px; color: #9fb0ff; }
.output ol { margin: 0; padding-left: 18px; }
.output li { margin-bottom: 4px; cursor: pointer; }
.output li:hover { color: #fff; }
.output code { color: #ff9ec4; }
.badge, .fps { position: fixed; z-index: 9001; padding: 3px 8px; color: #fff; background: #1d2130e6; border-radius: 6px; pointer-events: none; }
.badge { left: 56px; bottom: 18px; }
.fps { left: 56px; bottom: 46px; }
.fps.bad { background: #b4232c; }
`
