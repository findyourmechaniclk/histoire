# 08 — Side panes

## Outcome and prerequisites

Depends on: 05 (pane layout, states). Stories, search, tests, visual, MCP and AI panes use utilities. Pane edges keep the AGENTS.md layout contract (gutter, row inset, header height, density row paddings through theme spacing).

## Owned files

[Inventory slice 08](inventory.md#slice-08): `components/panes/{stories,search,tests,visual,mcp,ai}/*`.

Order: stories → search → tests → mcp → ai → visual (largest, container-query heavy).

## Implementation steps

1. **Row paddings.** Each list uses its density token (`--histoire-story-row-padding`, `--histoire-test-row-padding`, `--histoire-mcp-row-padding`, …): `htw:py-row-story htw:px-pane-row-inset`. Never all four sides from one density token; never hard-coded 16/8.
2. **Search.** `SearchScopes` full-width button group → slice 04 `HstButtonGroup` prop. `SearchPanel` `.workbench-state` → `fill` prop.
3. **Tests.** `FunctionalTestsPanel` `.histoire-switch` → root fallthrough. `TestsTreeRow` `:deep(svg)` and status icon colors → icon props/classes at render site; status color maps as full class strings per status. Keep `tests-panel`, `test-row`, `test-story-heading`, `collection-progress` markers. The indeterminate progress bar is in `histoire-vue` (`tests.css`), not here.
4. **Visual.** `VisualViewer` targets its own children (`.viewer-actions`, `.viewer-dock`, `.viewer-float`) under container queries: name the viewer container (`htw:@container/viewer`) and put `htw:@max-[…]/viewer:` variants on the children themselves (`VisualViewerActions`, `VisualViewerDock`, `VisualViewerHeader` own their responsive rules). Grid stacking (`grid-area: 1/1`) → `htw:col-start-1 htw:row-start-1`. `VisualViewerDock` `.histoire-icon-button` size → arbitrary property. `VisualTestsPanel` `.histoire-select` → fallthrough. `VisualViewerHeader` data-state chains → data variants. Keep `capture-message`, `screenshot-setup`, `recent-capture`, `phase-*` markers.
5. **MCP activity.** `McpActivity` (26 rules): row layout, status tones → data attributes + `htw:data-[tone=…]:`.
6. **AI.** `AiThreadHeader` `:deep(button)` → classes on its own buttons or `HstButton` fallthrough.

## Failure paths

- Container names must be unique per component tree; nested viewers (dock inside viewer) use distinct names.
- Virtualized lists measure row height: padding changes alter scroll math. Compare long lists against baseline at both densities.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510). Browser: each pane in light/dark/compact/375 px; tests pane running state; visual viewer at narrow and wide widths, slider, dock; MCP activity with entries; search with no results.

## Acceptance criteria

No `<style>` in owned folders; pane edges line up across tabs and densities as before.

## Non-goals

Pane behavior; `histoire-vue` test styles.

## Status

Not started.
