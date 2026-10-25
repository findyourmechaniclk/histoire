# 04 — Source fixes in `@histoire/vue` and `@histoire/controls`

## Outcome and prerequisites

Depends on: 03. Every app rule that reaches into another package's markup ([inventory: cross-package selectors](inventory.md#cross-package-selectors)) has a supported hook in that package. App files keep their old CSS until their owning slice switches to the hook; this slice adds hooks and proves them, it does not migrate app styles.

## Owned files

- `packages/histoire-vue/src/`: `HistoireEvents.ts`, `HistoireDocs.ts`, `HistoireTests.ts`, `HistoireControls.ts`, `StatePresets.ts`, `PresetMenu.ts`, `HistoireSource.ts`, `HistoireExtensionView.ts`, related types and their `__tests__`.
- `packages/histoire-controls/src/components/`: `HstButton.vue`, `HstSelect.vue`, `CustomSelect.vue`, `HstSwitch.vue`, `HstButtonGroup.vue`, `HstWrapper.vue` only where fallthrough is insufficient.
- Package docs/API reference pages for new props.

## Hook choice, in order

1. **Root fallthrough already works.** Vue SFCs in controls pass `class`/`style` to the root. If the app only styles the root (`.histoire-select` min-width and `--histoire-control-margin`, `.histoire-switch` `flex: none`), no source change; record "fallthrough" in the table below. Check `inheritAttrs` and which element is root first.
2. **Typed `classes` prop for inner parts.** `classes?: Partial<Record<Part, string>>` merged onto the default class of each part, documented part names. For `h()` components in `@histoire/vue` this is one helper (`mergePartClass(defaultClass, classes?.[part])`) reused by every component; do not duplicate per component. Parts needed today:
   - `HistoireEvents`: `root`, `count`, `loadMore` (the `> button`), `list` (`ol`), `row`, `heading`, `time`, `argument`. Plus the `--histoire-virtual-item-gap` variable via `style` or a `gap` prop.
   - `HistoireDocs`: `root`; table and heading styling of rendered markdown stays rule 7 ([architecture](architecture.md#conversion-rules)): app uses `htw:prose`-style descendant variants on `root`.
   - `HistoireTests`: `root`, `state` (wrapper of the embedded `WorkbenchEmptyState` equivalent).
   - `HistoireControls`: `root`, `fieldset`, `legend`, `reset`; `StatePresets`: `root`; `PresetMenu`: `trigger`.
   - `HistoireSource`: `root`, `pre`, `alert`, and a `showActions` boolean (replaces `display: none` on `.histoire-content-actions`). Changed-line highlight: expose `line` and `changedLine` parts if lines are rendered by the component; if Shiki emits them as HTML, keep rule 7 on `pre`.
   - `HistoireExtensionView`: `root`, `mount`, and an `interactive` prop that owns pointer-events behavior (today `OverlayItem.vue` forces `pointer-events: none !important` on `:deep(*)`). Behavior belongs to the component, not app CSS.
3. **Variant prop for a reusable look owned by the package.** `HstButton` accent-colored flat buttons (today forced by `WorkbenchEmptyState`/`WorkbenchErrorState`/`home.css` on `[data-color="flat"]`): add a documented color/tone value in controls with its own CSS, or have the state components pass a class to slotted buttons via a provided default. Pick one, apply to all three call sites.
4. `HstButtonGroup` full width (`SearchScopes`, `workbench-pane.css`): `block`/`fill` prop if the inner `.histoire-button-group-options` and `HstWrapper` content need it; fallthrough is not enough because three nested elements get `width: 100%`.
5. `.histoire-icon-button` size: already driven by `--histoire-icon-button-size`; app sets it with an arbitrary property on the button (`htw:[--histoire-icon-button-size:26px]`). No source change unless the variable is read from a non-root element.

## Tests first

Behavior only, in the owning package (`histoire-vue/src/__tests__`, controls tests):

1. `HistoireSource` `showActions: false` renders no actions (no copy/open buttons by role); default unchanged.
2. `HistoireExtensionView` non-interactive overlay: a real click at the overlay position reaches the frame below, not plugin content; interactive: plugin content gets it. DOM test environments ignore `pointer-events`, so this belongs in an existing real-browser suite that mounts plugin overlays (`histoire/src/node/__tests__/embed/integration`); if none mounts overlays, cover it in the browser matrix instead of adding a new harness.

No tests for `classes` passthrough or variants: they are presentation, covered by the browser matrix.

## Implementation steps

1. Re-grep `:deep(` and descendant selectors in app `.vue` and `.css` targeting `histoire-` classes not defined in the app; extend [inventory](inventory.md#cross-package-selectors).
2. Fill the table below per target: hook kind, API, consuming app slice.
3. Add the shared part-class helper in `@histoire/vue` (next to existing render utilities), then component props, types, JSDoc, docs.
4. Controls: fallthrough checks, then minimal props/variants.
5. Build both packages; the app must look identical (no app file changed).

| Target | Hook | API | App slice |
|---|---|---|---|
| (filled during the slice) | | | |

## API changes

New optional props (`classes`, `showActions`, `interactive`, button/group variants). Additive, documented in the `@histoire/vue` and controls API references.

## Failure paths

- Class merge order: app utilities live in `@layer utilities`, package CSS in `@layer components` (slice 03), so utilities win without `!important`. If a package rule is unlayered (e.g. embed standalone CSS), it does not matter for the app; verify in the browser matrix.
- Parts that do not exist as elements today: add the element only if it does not change embed consumer DOM in a breaking way; otherwise document as rule 7.

## Validation commands

~~~bash
pnpm --filter @histoire/vue test
pnpm --filter @histoire/controls test
pnpm --filter @histoire/controls build
pnpm --filter @histoire/app build
pnpm --filter histoire test:embed:integration
~~~

Browser: inspector Props/Docs/Events/Tests/Source, canvas overlays (`examples/plugin-reference`), empty/error states, search scopes; identical to baseline.

## Acceptance criteria

Every cross-package target has a hook or a recorded rule-7 decision; tests green; no visual change.

## Non-goals

Converting `@histoire/vue` or controls CSS to utilities; switching app files to the hooks (owning slices do that).

## Status

Not started.
