# Tailwind-only histoire-app slice plans

Status: planned 2026-10-24. No slice started. Base: `main` at `e42bad8f` with unrelated uncommitted work in the checkout (see [baseline.md](baseline.md) once slice 01 records it).

## Intended outcome

`packages/histoire-app` is styled with Tailwind utilities in templates. Custom CSS remains only where [exceptions.md](exceptions.md) records a reason it cannot be a utility.

- Tailwind v4 in `@histoire/app` and `@histoire/controls`, CSS-first config, `htw` prefix (`htw:flex`), no preflight.
- Zero `<style>` blocks in app `.vue` files. Component-level `.css` files deleted.
- `--histoire-*` tokens stay the public theming API and drive Tailwind theme values (`htw:bg-surface`, `htw:px-pane-gutter`, `htw:h-control`, `htw:rounded-control`).
- App no longer reaches into `@histoire/vue` / `@histoire/controls` internals with `:deep()` or descendant selectors. Those packages expose props, variants or class passthrough instead.
- Marker classes used by JS, tests and theming survive unstyled.
- Pixel-equivalent UI in light, dark, compact density, embedded and narrow layouts. Stories using their own Tailwind (v3 or v4) in the same document keep rendering correctly.

Today (2026-10-24): Tailwind 3.4 (`htw-` prefix), utilities in 7 of 194 app `.vue` files, `<style scoped>` in 136 (~123 KB), 16 `.css`/`.pcss` files (532 lines).

## Read first

1. [Architecture: Tailwind v4 setup and conversion rules](architecture.md).
2. [Inventory: every style block and CSS file, owning slice, marker classes](inventory.md).
3. [Exceptions: custom CSS allowed to remain](exceptions.md).
4. [Validation and acceptance](validation.md).
5. Slice documents in dependency order. Supporting documents own shared rules; slices must not redefine them.

## Slices and dependencies

1. [Baseline, screenshots and inventory check](01-baseline.md). Depends on none.
2. [`@histoire/controls` on Tailwind v4](02-controls-v4.md). Depends on 01.
3. [`@histoire/app` on Tailwind v4 and theme mapping](03-app-v4.md). Depends on 02.
4. [Source fixes in `@histoire/vue` and `@histoire/controls`](04-source-fixes.md). Depends on 03.
5. [Shell, base, menu and shared primitives](05-shell-and-base.md). Depends on 04.
6. [Canvas core, overlays, tools and views](06-canvas-core.md). Depends on 05.
7. [Canvas matrix and toolbar](07-canvas-matrix-toolbar.md). Depends on 06.
8. [Side panes](08-panes.md). Depends on 05.
9. [Comments](09-comments.md). Depends on 05.
10. [Inspector, embed dialog and pages](10-inspector-and-pages.md). Depends on 04, 05.
11. [Global CSS reduction and guard](11-globals-and-guard.md). Depends on 05–10.
12. [Conformance and handoff](12-conformance.md). Depends on 11.

## Milestones

- Foundation: 01–04. Tailwind v4 in both packages, theme mapped, cross-package hooks in place. UI unchanged. 02 and 03 land together: the v3 app cannot emit controls' `htw:` utilities in between.
- Shared primitives: 05. Shell states, panes, popovers, overflow toolbar items, menus become utility-styled components others compose.
- Feature folders: 06–10. Disjoint folders; 06→07 serial, 08, 09, 10 parallel with them once 05 lands.
- Closure: 11–12. Global CSS cut to exceptions, guard against regressions, conformance record.

## Confirmed defaults

- Tailwind v4 (user decision), package-local in app and controls. Root catalog Tailwind 3 stays for docs, `examples/vue3` and `histoire-controls-stories`.
- Prefix `htw` (v4 variant form `htw:`). Theme variables emitted as `--htw-*`, never `--color-*`, so story Tailwind themes are untouched.
- `:deep()` into other packages is fixed at source (user decision): those packages get props, variants or class passthrough.
- No `@apply`, no `@reference` in SFCs, no new component `.css` files.
- `--histoire-*` token names and values unchanged; documented theming keeps working.
- No commit, push or publish without separate instruction.

## Global implementation rules

- Preserve unrelated dirty, staged, untracked and concurrent changes. Own only files listed by your slice; coordinate before touching another slice's files.
- Authored source and test modules stay below 300 lines; split by responsibility. Long class lists in templates are fine; repeated lists become a component, not a shared class.
- JSDoc on new functions, props, types. Comment non-obvious variant chains (group/peer, container, data-state).
- Tests: no CSS/class/style assertions. Behavior tests only where a source fix changes an API (new prop, variant, slot). The guard in slice 11 is a source scan.
- Keep marker classes from [inventory.md](inventory.md#marker-classes) on the same elements, unstyled.
- `WorkbenchEmptyState`, `WorkbenchLoadingState`, `WorkbenchErrorState`, `WorkbenchPanelAction`, pane layout components and `HstPulsatingDisc` keep their roles and props (AGENTS.md). Never hard-code the pane gutter or row inset; use theme spacing.
- No "preview" in user-facing copy.
- `StoryVariantGridSandbox*` is slated for removal: convert mechanically only, never extend.

## Non-goals

Migrating `@histoire/vue` plain CSS (`src/styles/*.css`) to Tailwind, the docs site, `examples/*` styling, the user-facing Tailwind story plugin (`packages/histoire/src/node/builtin-plugins/tailwind`), visual redesign, renaming `--histoire-*` tokens.
