# 07 — Canvas matrix and toolbar

## Outcome and prerequisites

Depends on: 06 (viewport variables, frame props) and 05 (toolbar presentation composable). Matrix view, axis bar/form, matrix inspector, canvas toolbar, toolbar buttons and popovers use utilities. Overflow menu presentation handled by the items themselves.

## Owned files

[Inventory slice 07](inventory.md#slice-07): `components/canvas/matrix/*` (incl. `matrix-axis-form.css`), `components/canvas/toolbar/*`.

Order: `ToolbarButton`, `ToolbarPopover`, toolbar labels/values → `CanvasToolbar`, `ToolSwitch`, `ArrangeSwitch` → popovers (`ScreenshotPopover`, `ViewportMenu`, `ZoomMenu`) → matrix axis form/bar/entry → `MatrixInspector` → `MatrixView`.

## Implementation steps

1. **Toolbar presentation.** Consume `useToolbarPresentation()` from slice 05 in `ToolbarButton`, labels, shortcut/value spans, menu-only items and the search stepper; switch their own classes for `menu` vs `inline`. Then delete the remaining `:deep` rules in `BaseOverflowToolbarItem` (slice 05 left them for this).
2. **Icon sizes.** `ToolbarButton` sets `--histoire-icon-button-size` and `:deep(svg)`: arbitrary property on the `HstButton` + icon size prop. `ScreenshotPopover` `:deep(svg)` same.
3. **`!important` in `ViewportMenu`, `ZoomMenu`.** Find what they override (likely popover/menu defaults from slice 05 components). Remove the need through a prop on the base component; utilities with `!` (`htw:w-60!`) only if the override targets package CSS that cannot get a hook.
4. **`CanvasToolbar`** `:deep(.overflow-toolbar-item[data-toolbar-presentation="inline"] .histoire-tool-switch--leading)` → `ToolSwitch` reads presentation and a `leading` prop.
5. **Matrix axis form.** `matrix-axis-form.css` overrides `--histoire-control-*` variables for compact controls: arbitrary properties on the form root (`htw:[--histoire-control-height:28px]`), or a `size="sm"` on controls if slice 04 added one. Delete the file.
6. **Selects.** `MatrixAxisBar`, `MatrixInspector` style `.histoire-select`: root fallthrough (slice 04 table).
7. **`MatrixView`.** Uses viewport variables from 06 in `calc()`; `:deep(.histoire-matrix-cell)` → props on the cell component; `.workbench-state` → `fill` prop (05). Keep `histoire-matrix-*` markers. Container query in `MatrixAxisBar` → named container.

## Failure paths

- Overflow measurement: `BaseOverflowToolbar` measures item widths; changing inline item padding/gaps changes when items overflow. Compare overflow breakpoints at 1440, 1024, 768, 375 against baseline.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510) plus `pnpm run test:examples` (matrix Cypress specs). Browser: matrix with axes, axis editing, inspector, toolbar inline and overflow at all widths, screenshot popover, viewport and zoom menus.

## Acceptance criteria

No `<style>`/`.css` in owned folders; `BaseOverflowToolbarItem` has no `:deep`; overflow breakpoints unchanged.

## Non-goals

Toolbar behavior or item order changes.

## Status

Not started.
