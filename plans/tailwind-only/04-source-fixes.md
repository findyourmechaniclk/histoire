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
| `HistoireEvents` | Typed parts; root style fallthrough | `classes: root/count/loadMore/list/row/heading/time/argument`; `style="--histoire-virtual-item-gap: …"` | 10 |
| Events' native `ol` | Forwarded list part | `HistoireVirtualList.listClass` receives `classes.list` | 10 |
| `HistoireDocs` | Root part; rule 7 for sanitized HTML | `classes.root`; heading/table descendants on root | 10 |
| `HistoireTests` | Root and optional state wrapper | `classes.root/state`; state wraps empty/loading slot only when requested | 10 |
| `HistoireControls` | Typed parts, forwarded to actual children | `classes.root/fieldset/legend/reset/presets/presetTrigger/state` | 10 |
| `GenericControls` | Owns actual fieldset/legend | `classes.fieldset/legend`, forwarded by `HistoireControls` | 10 |
| `StatePresets`, `PresetMenu` | Typed parts | `StatePresets.classes.root/trigger`; `PresetMenu.classes.trigger` | 10 |
| `HistoireSource` | Parts and behavior prop | `classes.root/pre/alert`; `showActions=false` removes Raw/Dynamic/Copy | 10 |
| Shiki code lines | Rule 7 | Descendant utilities on `classes.pre`; no line parts because Shiki owns HTML | 10 |
| Native `HistoireExtensionView` and app-local `ExtensionView` | Additive parts and behavior prop | `classes.root/mount`; `interactive=false` sets inert and disables pointer targeting; omission preserves host behavior | 06, 10 |
| `HstSelect` | Existing explicit fallthrough | Root `class/style` forwarded to `HstWrapper` despite `inheritAttrs:false` | 07, 08, 10 |
| `CustomSelect` | Existing explicit fallthrough | Root attributes reach actual select trigger | 07, 08, 10 |
| `HstSwitch` | Existing explicit fallthrough | `useControlField` separates root class/style from input attributes | 08, 10 |
| Flat `HstButton` | Opt-in tone | `color="flat" tone="accent"` for empty actions; `tone="danger"` for error actions; home cards use root utilities | 05, 10 |
| `HstButtonGroup`, `HstWrapper` | Opt-in layout | `block` stretches wrapper/content/value/options; root `class` remains supported | 05, 07, 08, 10 |
| Icon-only `HstButton` | Existing root variable | Root `style` or arbitrary property `--histoire-icon-button-size` | 05–10 |
| `HstTextarea` | New native-field class hook | `inputClass` targets textarea; root class/style still fall through | 05 |
| Other `HstButton` roots, `BuiltinIcon`, `HstPulsatingDisc` | Existing root fallthrough / sizing props | Direct classes, `size`, or inherited `currentColor`; no inner hooks needed | 05–10 |

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

Implemented 2026-10-25, uncommitted. Implementation complete. Final rebuilt-artifact pointer checks and 48-screen comparison pass; inherited broad validation limits remain documented below.

Landed:

- Shared typed `HistoirePartClasses`, prop factory and marker-preserving merge helper; native panels expose every part in the hook table.
- `HistoireSource.showActions` removes its built-in actions without changing content lifecycle. Small source renderer applies an escaped class attribute to Shiki's `pre`, or to the plain-text fallback. Individual lines remain rule 7.
- `HistoireControls` forwards fieldset/legend styling to `GenericControls` and preset styling to `StatePresets`/`PresetMenu`. `HistoireVirtualList.listClass` reaches the event `ol` using the scroller's existing public prop. State wrappers appear only when their part is supplied.
- `HstButton.tone` adds flat accent/danger text; `HstButtonGroup.block` and `HstWrapper.block` own nested full-width layout. `HstTextarea.inputClass` exposes clipboard-recovery textarea sizing. Existing select/switch/button/icon fallthrough retained.
- Both native and app-local extension views expose `classes.root/mount` and `interactive`. Explicit passive views become inert; explicitly interactive direct plugin children can opt back into pointer input under a pointer-transparent layer. Omission preserves existing host input behavior, including tool layers. Native `styles/extensions.css` owns that behavior.
- API documented in `docs/reference/panel-styling.md`, linked from embedding and controls guides. Inventory re-grepped and hook table filled. No app styles or consumers migrated; only app-local extension's invisible additive API changed.

Deviations from the draft:

- Several listed targets live in nested folders. Fieldsets/legends belong to `GenericControls`, event `ol` belongs to `HistoireVirtualList`, and app extension surfaces use their own `ExtensionView.vue`, not the native view. Hooks follow those actual owners.
- Events `loadMore` part names the current **Clear** button; there is no pagination. Kept the requested key, documented actual behavior.
- Error-state buttons are danger-colored, not accent-colored; home CSS now styles whole cards/rows and has no generic flat-accent rule. Added both tone values; left call-site adoption to slices 05/10 as required by this task's unchanged-UI boundary.
- Re-grep found clipboard recovery's inner textarea omitted from the initial inventory. Added its class hook rather than leaving a cross-package descendant selector for slice 05.
- No extra wrapper in default DOM: empty/loading state wrapper is opt-in. Shiki-generated lines use descendants on `pre`; no artificial `line`/`changedLine` props.
- Slice 03's actual E12 output is unlayered. Existing provider selectors and Shiki inline background can outrank plain utilities; API docs explicitly show Tailwind important modifiers for those declarations. No global specificity rewrite or new app CSS exception introduced.
- Browser pointer coverage uses the existing embed integration fixture/bundler, with one new scenario file covering both Vue and DOM plugin views; no new test harness. It waits for runtime admission before clicking the underlying iframe.

Exceptions added: none. Native package CSS remains outside the app-only migration. No dependencies installed; no files staged, committed, stashed or reverted.

Tests added:

- `histoire-vue/src/__tests__/source-highlighting.spec.ts`: default action names, reactive action removal/restoration, preserved real-highlighted source, still-working action after restoration. Remote source transport only is substituted. Red-before-green failure was remaining three buttons after `showActions=false`.
- `histoire/src/node/__tests__/embed/integration/extension-interactivity.spec.ts`: real pointer and focus behavior for Vue and DOM plugin views above a real story iframe; checks pass-through, interactive handling and preserved mount identity. Uses existing real embed fixture, with no component/runtime mocks.

Validation completed so far:

- Native build passes. Controls peer JS/CSS/types and app Vite/CSS/copied assets pass through existing separate build steps.
- Native tests: 155 files / 774 passed. Controls: 24 files / 90 passed after restoring font-copy output skipped by the known full-build failure. Histoire: 404 files / 2,083 passed, 1 file / 2 tests skipped.
- Full controls/app builds retain prior declaration failures: `Module '"@iconify/vue"' has no exported member 'Icon'` and `Module '"vue"' has no exported member 'createApp'`. Root `vue-tsc` is absent; installed controls binary reports the same 1,309 workbench errors. Those gates remain failed, not reclassified by successful JS/CSS builds.
- Full embed integration: 45 files / 86 tests pass; 4 files / 9 failures exactly match prior `visual-recovery`, `visual-regression`, `visual-transport`, and `vue-host-isolation` failure names. New two-scenario pointer file passes in that run and independently after the final native/app rebuild.
- Lint passes with 39 existing warnings; whitespace check passes. All authored source/test files stay below 300 lines.
- Tailwind integration: 8 passed / 6 failed in the same two files/six scenarios as slice 03. `evidence/after-04/baseline-failures.json` compares exact failure names for both integration suites; no new failures.
- `pnpm run test:examples`: Vue3 build passes; Cypress cannot start tests: `EROFS: read-only file system, open '/home/akryum/.config/Cypress/cy/production/cache'`. Left user configuration untouched.
- Rebuilt native pointer check: 2/2 pass for Vue component and DOM mount views, including an adversarial passive child opting into pointer events. Pre-rebuild artifact run failed the interactive click without the new pointer rule, confirming the test reaches that behavior.
- Final 48-screen comparison after the pointer-layer refinement: 48 exact matches, zero browser errors, using baseline except the five specified after-03 font references. Owned preview PID 2298 stopped after capture; first capture PID 1753 also stopped. Full integration runs preceded the final opt-in refinement; the final native suite, focused browser scenarios and screenshots were rerun after it.

Remaining baseline limits: vendor declarations, missing root vue-tsc, nine embed/six Tailwind integration failures and Cypress's read-only configuration. No baseline screenshots exist for static inspector Tests or an injected source error; those are not claimed as visual proof. Packed installed-consumer suites were deliberately skipped because they install dependencies. No baseline or after-03 image was modified. See `evidence/logs/04/` for raw output and `evidence/after-04/` for captures.
