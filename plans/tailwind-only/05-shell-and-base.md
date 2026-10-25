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

Not started.
