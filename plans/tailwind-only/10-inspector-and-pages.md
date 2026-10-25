# 10 — Inspector, embed dialog and pages

## Outcome and prerequisites

Depends on: 04 (hooks for events, docs, tests, controls, source, extension views), 05 (states). Inspector tabs and bodies, Source drawer, embed dialog, home, settings and markdown pages use utilities. The biggest cross-package consumer: switches to slice 04 hooks.

## Owned files

[Inventory slice 10](inventory.md#slice-10): `components/inspector/*`, `components/embed/EmbedDialog.vue`, `components/pages/home/*` (incl. `home.css`), `components/pages/settings/*` (incl. `settings.css`, `agents-settings.css`), `components/pages/markdown/*` (incl. `markdown.css`).

Order: inspector (`InspectorTabs`, `PropsTab`, tab bodies, `SourceDrawer`, `StoryInspector`) → embed dialog → home → settings → markdown.

## Implementation steps

1. **`StoryInspector` (17 `:deep`).** Docs, events, tests, extension views → `classes` parts from slice 04, applied where those components are rendered (tab body components `DocsTab`, `EventsTab`, `TestsTab`). `[data-active-tab="docs"] :deep(.inspector-source)` → `SourceDrawer` prop (`tone="surface"`). Inspector gutter via theme spacing (`--histoire-inspector-gutter` gets a theme entry in slice 03 if missing). Keep `histoire-inspector-frame`, `inspector-source`, `inspector-source-retry`.
2. **Dynamic class.** `` `inspector-test-${status}` ``: replace with a status → class-string map so the scanner sees literals; keep the old class only if a test or JS reads it (grep first).
3. **`PropsTab`.** Controls, presets, reset, legend/fieldset → slice 04 parts; `calc(var(--histoire-inspector-gutter) - var(--histoire-control-wrapper-padding))` → arbitrary value with both variables. `.workbench-state` → fallthrough class/`fill` prop.
4. **`SourceDrawer`.** `HistoireSource` parts and `showActions: false`; changed-line highlight per slice 04 decision (part or rule 7 on `pre`: `htw:[&_.line[data-source-changed]]:bg-accent/15`). Hard-coded `#f87171` alert color → token (`htw:text-danger`, check dark contrast against baseline). `background: transparent !important` on `pre` overrides Shiki inline style: keep as `htw:bg-transparent!` on the `pre` part, recorded as acceptable `!`.
5. **`InspectorTabs`** `:deep(svg)` → icon size prop.
6. **`EmbedDialog`** (41 rules): `label:has(:checked|:disabled)` → `htw:has-checked:`/`htw:has-disabled:`; button group via slice 04 hook; split the component if the template passes 300 lines.
7. **Home.** `home.css` exists to beat `.histoire-button[data-color]`: slice 04 variant removes the fight; delete file. Breakpoints 1100/1000 px → `htw:max-[1099px]:` (or theme `--breakpoint-*` if reused). `NeedsAttention` `.row + .row` → `htw:divide-y` / `htw:[&+&]:` on rows.
8. **Settings.** `settings.css`, `agents-settings.css` (`:has()`, `::before` state dots, `::-webkit-details-marker`, selects/switches/button groups via slice 04): into components; details marker via `htw:[&::-webkit-details-marker]:hidden htw:list-none`. Keep `histoire-settings-content`.
9. **Markdown page.** `markdown.css` styles user docs under `.histoire-docs` (rule 7): `htw:prose` on the docs root plus overrides for header anchors (from `main.pcss` `.htw-prose` rule), tables, code, blockquotes; grid `minmax(0,680px) 200px` → `htw:grid-cols-[minmax(0,680px)_200px]`; dark selector → `htw:dark:`. Keep `histoire-docs`, `header-anchor`, `histoire-markdown-path` markers (outline DOM and `MarkdownPage.vue:76` query them). Delete file.

## Failure paths

- Docs rendered both in inspector (compact) and markdown page (full): two prose configurations on two roots; do not share via global CSS.
- `outline-dom.ts` scans `.header-anchor`; typography changes must not drop anchors.

## Validation commands

Per [folder slice procedure](architecture.md#folder-slice-procedure-0510) plus `pnpm --filter @histoire/vue test` (`inspector-extensions`, `source-expansion`, `standalone-docs-links`), `pnpm --filter histoire test:embed:integration` (`inspector-plugin-tab`). Browser: all inspector tabs incl. plugin tab, events with many entries, Source drawer changed lines and error, embed dialog options, home at 1440/1024/375, settings general/agents, markdown page with outline.

## Acceptance criteria

No `<style>`/`.css` in owned folders; no app selector into package internals remains; matrix rows unchanged.

## Non-goals

Inspector behavior, docs rendering pipeline.

## Status

Not started.
