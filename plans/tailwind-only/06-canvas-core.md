# 06 — Canvas core, overlays, tools and views

## Outcome and prerequisites

Depends on: 05. Canvas viewport, frames, single variant, header/status/measure hints, resize handles, overlays, tools and plugin views use utilities. Canvas marker classes (most-tested part of the UI) survive.

## Owned files

[Inventory slice 06](inventory.md#slice-06): `components/canvas/*.vue` (top level), `canvas/overlays/*`, `canvas/tools/*`, `canvas/views/*`. Not `canvas/matrix`, `canvas/toolbar` (07).

Order: `CanvasFrame` → `FrameGrid` → `CanvasSingleVariant`, `SingleVariantResizeHandles` → `CanvasHeader`, `CanvasStatus`, `CanvasMeasureHint`, `CanvasInfo*` → overlays, tools, views → `CanvasViewport` last (it defines local variables others read).

## Tests first

None expected. Marker classes are guarded by existing suites (`canvas-overlay-geometry.spec.ts`, `embed/integration/canvas-content-sizing.spec.ts`, `examples/vue3/cypress`); run them.

## Implementation steps

1. **`CanvasFrame` states.** Today `.is-selected`, `.is-highlighted`, `.is-dimmed` with chains like `.histoire-canvas-frame:not(.is-selected):not(.is-highlighted) .histoire-frame-label:enabled:hover`. Add `data-selected`, `data-highlighted`, `data-dimmed` attributes; frame root is `htw:group/frame`; children use `htw:group-data-[selected=false]/frame:…` and `htw:not-group-data-[highlighted=true]/frame:hover:…`. Keep `is-selected` as marker (tests use `.histoire-canvas-frame.is-selected`). Keep `histoire-frame-content`, `-title`, `-label`, `-select`.
2. **Viewport local variables.** `CanvasViewport` defines `--histoire-canvas-inspector-reserve` and `--histoire-canvas-info-inset`, read in `calc()` by `CanvasStatus`, `MatrixView` (07) and itself. Set them with `:style` (computed from props) or arbitrary properties on the viewport root; consumers use `htw:bottom-[calc(var(--histoire-canvas-info-inset)+8px)]`. Keep names (slice 07 depends on them). `:deep(.histoire-canvas-frame)` and `:deep(iframe)` from viewport/grid → frame props (`dragging`, `interactive`) owned by `CanvasFrame`.
3. **Container queries.** `CanvasHeader`, `CanvasStatus` (`span:nth-child(n+4)` hidden under a width), `CanvasMeasureHint`: `htw:@container/canvas-status` + `htw:@max-[480px]/canvas-status:[&>span:nth-child(n+4)]:hidden` or, better, mark the collapsible spans with a prop/flag and use `htw:@max-[480px]/canvas-status:hidden` on them directly.
4. **Status hints.** `CanvasStatus` styles slot/rendered `kbd` and `.canvas-hint-title` via `:deep`: style at the render site (component that renders hints) or a `CanvasHint` component.
5. **Resize handles.** Keyboard-input state on parent (`[data-keyboard-input="true"] .handle:focus-visible`) → `htw:group/handles` + `htw:group-data-[keyboard-input=true]/handles:focus-visible:…`. `color-mix()` → opacity modifiers.
6. **Measure hint.** `scrollbar-width: none` → `htw:[scrollbar-width:none]`.
7. **Overlays.** `OverlayItem` pointer-events logic → `HistoireExtensionView` `interactive` prop (slice 04); positioning → `classes.root`/`classes.mount` parts. `PluginCanvasView` `:deep(.histoire-extension-mount)` → same parts.
8. **Single variant iframe.** `CanvasSingleVariant` `:deep(iframe)`: the iframe is created by the frame/replica component; give it a class there or a prop. Do not use descendant variants unless the iframe is created outside Vue (then rule 7).
9. **Reduced motion.** `CanvasViewport` media query → `htw:motion-reduce:`.

## Failure paths

- Canvas performance: thousands of frames re-render on hover/selection. Group variants are CSS-only; do not compute class strings per frame from reactive state that was not already reactive.
- Selection tests read `.is-selected`: keep it in the `:class` binding even though styling uses `data-selected`.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510) plus `pnpm --filter histoire test:embed:integration` and `pnpm run test:examples`. Browser: grid/list/single, selection, highlight, dimming, frame label hover, resize handles with keyboard, measure hints, status at narrow width, plugin overlays and custom view (`examples/plugin-reference`).

## Acceptance criteria

No `<style>` in owned files; canvas suites and Cypress green; matrix rows unchanged.

## Non-goals

Matrix and toolbar (07); canvas behavior changes.

## Status

Not started.
