# 05 — Shell, base, menu and shared primitives

## Outcome and prerequisites

Depends on: 04. Shared building blocks other folders compose are utility-styled and expose props instead of being restyled from outside: workbench states, pane layout, popovers, overflow toolbar items, menus, rail, shell layout. Later slices (06–10) rely on these props.

## Owned files

[Inventory slice 05](inventory.md#slice-05): `components/shell/*`, `components/base/*`, `components/menu/*`, `components/misc/*`, `components/story/*`, `components/agents/*`, plus `shell/workbench-pane.css`, `shell/workbench-state.css`, `agents/agents.css`.

Order: `workbench-state.css` + `WorkbenchEmptyState`/`LoadingState`/`ErrorState`/`LoadingSkeleton` → `workbench-pane.css` + `WorkbenchPane*` → `BasePopover` → `BaseOverflowToolbar*` → `menu/*` → `AppRail`, `RailButton`, `SidePanelHost`, `InspectorFrame`, `ShellLayout` → rest.

## Tests first

None expected: pure presentation. If a component gains a prop (below), its existing behavior tests stay green; add no class/style assertions.

## Implementation steps

1. **Workbench states.** `workbench-state.css` rules move into the three state components. Other folders target `.workbench-state` with `:deep` to set `flex: 1` or margins (`MatrixView`, `PropsTab`, `SearchPanel`, `VisualViewer`, `StoryInspector`): add a `fill` boolean prop (and accept fallthrough `class` on the root for margins) so callers stop reaching in. Flat-button accent in `actions` uses slice 04's hook. Keep `role="alert"` on the error state.
2. **Skeleton keyframes.** `WorkbenchLoadingSkeleton` uses `htw:animate-skeleton-pulse htw:motion-reduce:animate-none` from the theme ([architecture](architecture.md#theme-mapping-srcappstylethemecss)).
3. **Pane layout.** `workbench-pane.css` uses sibling combinators (`:is(header, toolbar) + .workbench-pane-toolbar`) to adapt toolbar spacing to its position. Replace with an explicit `position`/`after` prop on `WorkbenchPaneToolbar` (`'start' | 'header' | 'content'`) computed by callers, or with `htw:[header+&]:pt-0`-style arbitrary variants if callers cannot know. Prefer the prop; AGENTS.md layout rules (gutter, header height, row inset tokens) map to theme spacing.
4. **Popover parts.** `BasePopover` styles slot content classes (`.popover-row`, `.popover-title`, `.popover-meta`, `.popover-divider`, `.popover-error`). Turn them into tiny components (`PopoverRow`, `PopoverTitle`, …) in `base/popover/`, used by callers, instead of descendant styling.
5. **Overflow toolbar items.** `BaseOverflowToolbarItem` restyles child toolbar items when presented in the overflow menu (`[data-toolbar-presentation="menu"]` → `:deep(.toolbar-action-label|-shortcut|-value)`, `.search-match-stepper`, `.histoire-toolbar-button`, separators via `::before`). Provide the presentation via `provide`/`inject` (`useToolbarPresentation()`), and let `ToolbarButton`, `ToolbarPopover`, search stepper and labels switch their own classes. Keep `data-toolbar-presentation` as attribute (behavior hooks read it). Toolbar item components live in slice 07's folders: this slice adds the composable and converts base components; slice 07 converts the consumers. Until 07 lands, keep the old `:deep` rules for those consumers in place (do not delete the block early).
6. **Menus.** `MenuItem` `:deep(svg)` sizing → icon size prop on `BuiltinIcon` usage or `htw:*:[svg]:size-4` if icons come from slots. `ContextMenu` `:deep(textarea)` → class on the textarea where it is rendered.
7. **Rail and shell.** `AppRail` computes `--histoire-rail-button-size` from `100cqw`: set it via `htw:[--histoire-rail-button-size:calc(100cqw-…)]` on the container query child; if Tailwind cannot express it readably, add an exception. `ShellLayout` sets `data-density` (marker) and styles `:deep(.histoire-app-rail)` → prop/class on `AppRail`. Container queries → `htw:@container/shell` etc.
8. **Density tokens.** Decide [exceptions E4](exceptions.md#expected): try arbitrary properties for compact overrides on `ShellLayout` root (`htw:data-[density=compact]:[--histoire-list-row-padding:6px]` × 13). If unreadable, keep `density.css` and confirm E4.
9. **Agents.** `agents.css` (`.histoire-provider .histoire-agent-permission …`) into the owning templates. `AgentLogo` CSS mask from `var(--agent-logo)`: `htw:[mask:var(--agent-logo)_center/contain_no-repeat]` plus `-webkit-` via v4 autoprefixing, or exception.
10. **Legacy grid sandbox.** `StoryVariantGridSandboxItem` `v-bind()` → inline `:style`. Mechanical only.

## Failure paths

- Removing a `.workbench-state` `:deep` caller before the `fill` prop exists breaks layout: land prop first, callers in their slices.
- `provide`/`inject` presentation must default to `inline` so toolbar items outside an overflow toolbar render unchanged.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510). Browser: every screen with empty/loading/error states, rail collapsed/expanded at narrow widths, overflow toolbar in menu mode, context menus, compact density.

## Acceptance criteria

No `<style>` and no `.css` in owned folders (except exceptions); new props documented with JSDoc; matrix rows unchanged.

## Non-goals

Converting the toolbar item consumers (07), pane contents (08).

## Status

Implemented locally 2026-10-25. Source and visual acceptance complete; inherited
build/test limits remain below. Ready for dependent slices 06–10. No staging,
commits, dependency installs, or changes to baseline/after-03 images.

### Landed and handoff APIs

Paths below are relative to `packages/histoire-app/src/app/components/`:

- `shell/WorkbenchEmptyState.vue`, `shell/WorkbenchLoadingState.vue`,
  `shell/WorkbenchErrorState.vue`: optional `fill?: boolean`, default false.
  Root class/style fallthrough reaches shared `shell/WorkbenchStateLayout.vue`.
  `fill` gives flex growth, zero minimum width, and overflow scrolling. Existing
  status/alert semantics, details, and action slots remain. Flat action buttons
  now explicitly use controls' `tone="accent"` or `tone="danger"` at call sites.
- `shell/WorkbenchPaneToolbar.vue`: `position?: 'start' | 'header' | 'content'`.
  `header` has zero top padding; `start` and `content` use pane-gutter padding.
  Omission retains sibling inference for current consumers and plugin roots.
  Later slices should pass explicit positions. Pane groups use `block` plus
  `class="htw:flex-1 htw:min-w-0"` on the actual `HstButtonGroup`.
- `base/overflow/presentation.ts`: `useToolbarPresentation()` returns
  `ComputedRef<ToolbarPresentation>`; exported `ToolbarPresentation` is
  `'inline' | 'menu'`. Reuses `useOverflowToolbar()` and existing item injection,
  so state follows the persistent item across Teleports and defaults to inline.
  **Slice 07:** retain wrapper `data-toolbar-presentation`, and remember clone
  measurement normalizes that attribute. Keep clone-sensitive geometry in
  wrapper/group data variants rather than baking menu-only classes into clones.
- `base/popover/PopoverRow.vue`: native flat button by default; `as="label"`
  renders a field-label row. Attributes, listeners and classes fall through.
  `PopoverTitle.vue` (`p`), `PopoverMeta.vue` (`span`), `PopoverDivider.vue`
  (`div`), `PopoverError.vue` (`p`) in the same directory own each part's layout.
  `PopoverTitle.compact` retains the smaller setup-control gap without competing
  margin utilities. Error callers retain `role="alert"`; dividers retain any supplied separator role.
- Shell rail, resize handle, inspector, pane host, plugin pane, menus, mask logo,
  hatch, panel action and legacy story bindings converted to utilities. Skeleton
  uses existing theme animation with reduced-motion opt-out. Three component
  stylesheets deleted: `workbench-state.css`, `workbench-pane.css`, `agents.css`.
- Exact source changes: [`evidence/files-05.json`](evidence/files-05.json).
  Seven source files created, 42 changed (including existing state test), three
  deleted. Plan/evidence files are additional documentation/artifacts.

### Deviations and exceptions

- E13 is the one remaining owned SFC style block: only the explicitly requested
  temporary `BaseOverflowToolbarItem` consumer bridge. Wrapper, content, hidden
  state and separator styles have moved to utilities. Slice 07 removes E13 after
  converting its toolbar consumers. No new component CSS files.
- E4 confirmed: existing provider defaults and compact density overrides stay in
  `density.css`. There are 17 defaults and 13 compact overrides in current code;
  keeping the public reset boundary avoids an unreadable token attribute list.
- Shared selector removal required small caller adoptions in slices 06–10:
  popover parts, flat-button tones and three pane-group `block` call sites.
  Inventory lists exact files. Their feature styles otherwise remain untouched.
  Existing 306-line `SearchPanel.vue` receives only a same-line tone attribute;
  splitting this unrelated feature belongs to its owning slice.
- Kept `workbench-state`, `workbench-pane-header`, `workbench-pane-toolbar` while
  old feature selectors and omitted-position callers still need them. Kept
  `workbench-loading-skeleton`, used by capture readiness. Inventory updated.
- Provider itself already supplies the size-query container. Shell queries keep
  that boundary; adding an inner container would change panel/rail query sizes.
  Arbitrary `[@container(max-width:640px)]` variants preserve the original inclusive
  boundary (built-in `@max-[640px]` uses a strict less-than test).
- E12 also affects *utilities* in peer CSS (`.histoire-provider .htw\:flex-col`,
  `.htw\:grid`, `.htw\:relative`, `.htw\:gap-2`) as well as component selectors.
  No hook removes those declarations for these particular elements. Important
  modifiers are limited to conflicting geometry: mobile rail direction/gap/
  display, mobile pane position, popover/menu button display/spacing/alignment,
  menu/backdrop padding, panel-action vertical padding/split corners, resize-independent
  toolbar trigger hiding and rail disabled opacity.
  Rail selection deliberately keeps package's actual existing appearance.

### Validation

- `pnpm --filter @histoire/app build`: Vite passes; complete script stops at
  inherited embed declaration errors (`Module '"vue"' has no exported member
  'createApp'`). Separate `pnpm --filter @histoire/app exec vite build`,
  `pnpm --filter @histoire/app build:css`, and `node scripts/copy.mjs` pass.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @histoire/vue test`:
  155 files / 774 tests pass. Initial run had one exact-prop-bag assertion fail
  because optional `fill` adds a false default. Existing test now preserves its
  icon contract and checks actual status title/detail. Focused run: 4/4 pass.
  No new package tests; no class/style assertions.
- `pnpm --filter histoire test:embed:integration`: 45 files / 86 tests pass;
  4 files / 9 fail. `pnpm --filter histoire test:tailwind:integration`: 3 files /
  8 pass, 2 files / 6 fail. Exact failure-name sets match slice 04, with no new
  failures; see `evidence/after-05/baseline-failures.json`. Representative inherited
  errors: `Visual testing requires enabled configuration and a ready development
  source`, `Maximum call stack size exceeded`, missing screenshot files, and
  timeouts. These remain failed gates, not successful validation.
- `pnpm run test:examples`: Vue3 build passes (44 stories / 1,098 variants), but
  Cypress cannot start: `EROFS: read-only file system, open
  '/home/akryum/.config/Cypress/cy/production/cache'`. User configuration untouched.
- Root `pnpm exec vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json`
  fails because `Command "vue-tsc" not found`. Installed controls vue-tsc runs
  with the same 8 GB heap and reports existing vendor/Vue declaration problems,
  including those missing exports reached by the new presentation helper.
- Scoped ESLint and `git diff --check` pass. Owned source remains under 300 lines;
  only the pre-existing borrowed `SearchPanel.vue` remains 306 lines. Source scan
  finds just E13's style block; no CSS files, deleted imports, or old popover-part
  classes remain in the converted folders/call sites.
- Commands used installed Node 24.16.0 and cached pnpm 10.33.0 through temporary
  PATH shims after mise reported `Read-only file system (os error 30)`.
  Every build, package suite, and capture/compare session uses
  `flock /tmp/histoire-tailwind.lock`. Raw logs: `evidence/logs/05/`.

### Screenshot results and remaining limits

Final rebuilt artifacts: 100 Vue3 captures and four Nuxt/Tailwind 4 captures
match exactly: **104/104, zero changed pixels, zero browser errors**. Final
comparison: `evidence/diffs-05-complete/summary.json`; concise receipt:
`evidence/visual-summary-05.json`. Reference selection uses baseline except the
five specified after-03 font-corrected images. Neither source set was modified.

Ten additional screenshots exercise context menus/submenus in light, dark,
compact, 375 px and exact 640 px modes. All capture successfully, with zero
browser errors. Assertions check actual menu focus and that every rail action
stays in the viewport; all images were visually inspected. These have no
baseline reference, so they prove usable layout/keyboard behavior rather than
pixel parity. Reusable preloader: `evidence/capture-05-extras.mjs`, used through
`NODE_OPTIONS=--import=./plans/tailwind-only/evidence/capture-05-extras.mjs` with
`serve-capture.mjs --only 'shell-*' --modes light,dark,compact,narrow,edge`.
Initial root-menu assertions omitted the accessible shortcut suffix; matching
its stable label prefix fixed the harness and all modes were recaptured.

All captures/comparisons ran under the global lock. Every server started by the
capture wrapper logged its matching stop; final full Vue3 PID 15, 640 px PID
3574, final Nuxt PID 4073, final root-menu PID 15 (separate invocation namespaces).
Ports 4610/4611 were used; reserved 6006/6106 were never used. Cypress's existing
wrapper uses 4567 and cleans up after its startup failure.

CSS size receipt: `evidence/css-sizes-05.json`. Bundled app.css is 178,310 bytes
(27,743 gzip), down 9.30% from slice 03's 196,584 bytes. Standalone app style.css is
139,198 bytes (16,932 gzip), up 20.50% because moved declarations now live in the
shared utility output. Combined raw output grows about 1.7%; combined gzip
shrinks slightly. No component CSS replacement files were added.

Initial diagnostic images in `after-05-initial` exposed provider-scoped utility
specificity: narrow rail/pane layout, popover row spacing/alignment, and rail's
actual package-owned selection colors. All were corrected before the matching
comparison. One diagnostic Stories/narrow capture also failed readiness because
the misplaced pane left no canvas width. No intentional visual differences.

Remaining for orchestrator/later slices: resolve inherited Vue/vendor declarations,
missing root vue-tsc, nine embed/six Tailwind integration failures, and Cypress's
read-only cache if green broad gates are required. Packed installed-consumer
suites were skipped under the no-install rule. Static books cannot exercise
live agent permission prompts or dev-only loading/error/screenshot setup states;
no pixel-parity claim is made for those unavailable baseline surfaces. Slice 07
must remove E13 after consuming presentation state. Other feature folders retain
their own styles until their assigned slices; no further slice 05 work is pending.
