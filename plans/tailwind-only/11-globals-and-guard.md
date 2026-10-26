# 11 — Global CSS reduction and guard

## Outcome and prerequisites

Depends on: 05–10. Global CSS in `packages/histoire-app/src` matches [exceptions.md](exceptions.md) one-to-one; a guard stops new custom CSS; AGENTS.md states the rule.

## Owned files

- [Inventory slice 03/11](inventory.md#slice-0311) and [slice 11](inventory.md#slice-11): `app/style/{tokens.pcss,density.css,document.pcss,controls.css,fonts.pcss,main.css,theme.css}`, `embed/document.css`, `embed/EmbedDocument.vue`.
- New guard test (location below), `AGENTS.md`, `src/app/style/README.md`, [exceptions.md](exceptions.md).

## Tests first

Guard test in `packages/histoire/src/node/__tests__/` (where repo-level source checks live) or as an app-level vitest node spec, whichever already hosts source scans:

1. No `.vue` file under `packages/histoire-app/src` contains `<style`.
2. Every `.css`/`.pcss` file under `packages/histoire-app/src` is on an allowlist kept in the test (mirrors exceptions table).
3. No `:deep(` anywhere in app source.

Source scan, not a presentation test: it fails on structure, never on visual output.

## Implementation steps

1. `EmbedDocument.vue` style block → utilities or into `embed/document.css` (E9) if it styles `html`/`body`.
2. For each exception candidate (E4, E7), try the alternative described in [exceptions.md](exceptions.md); confirm or remove the entry.
3. Remove dead rules: grep each selector in remaining global files against templates, TS and tests; delete unused ones (e.g. leftovers of classes deleted by 05–10).
4. `tokens.pcss`: only token definitions, dark overrides and scoped resets that cannot be utilities on a root template (`::selection`, placeholder, scrollbar, `:focus-visible` outline on any element inside the workbench). Moving resets to utilities on the root (`htw:selection:…`, `htw:placeholder:…` as `*:` variants) is allowed if readable; otherwise keep and record in E3.
5. `main.pcss` rename leftovers: confirm no `.pcss` imports point to removed files.
6. AGENTS.md: add under a "Styling" heading: histoire-app uses Tailwind utilities only (prefix `htw:`); no `<style>` blocks, no component `.css`; tokens via theme utilities; package internals via hooks, never descendant selectors; exceptions live in `plans/tailwind-only/exceptions.md` and the guard allowlist.
7. `src/app/style/README.md`: theme utility names per token, how to add a token (define in `tokens.pcss`, map in `theme.css`, extend the theme coverage test).
8. Repo memory: no change needed beyond AGENTS.md.

## Failure paths

- Guard false positives (documentation `.md` mentioning `<style`): scan only `.vue` files.

## Validation commands

All of [validation.md](validation.md#per-slice-commands). Browser: full matrix.

## Acceptance criteria

Guard green; exceptions table equals remaining CSS; AGENTS.md updated.

## Non-goals

Token renames or value changes.

## Status

Implemented and validated locally on 2026-10-25 within the baseline limits below.
No staging, commit, branch, dependency installation, or reserved-port use.

### Landed

- Converted the sole remaining SFC style block in `embed/EmbedDocument.vue` to
  literal utilities. All 224 app Vue files now have zero style blocks; no deep
  selectors remain. Eight global CSS/PCSS files remain, exactly the guard
  allowlist. No component CSS file was added.
- Added `histoire/src/node/__tests__/app-styling-guard.spec.ts`: Vue style-block,
  stylesheet allowlist, and deep-selector checks. It first failed on the real
  `EmbedDocument.vue` style block, then passed all three checks.
- Audited E3–E10. Kept density resets for cross-package inheritance and hidden
  runtime mounts for reliable visibility under arbitrary story CSS. Documented
  all remaining global rules; reduced root reset specificity with `:where()`.
- Removed **345 of 346 important utility occurrences** across **67 app files**.
  The one retained source-background override defeats Shiki's inline background
  and is documented in the Important modifiers table.
  Native provider qualification and peer CSS use `:where(.histoire-provider)`;
  controls' context/appearance qualifiers no longer outrank passed-through
  utilities. Native element/alert-role qualifiers and disabled defaults yield to explicit
  utility classes, including hidden disabled actions and source-error text.
- Corrected static stylesheet order in `src/bundle-main.js`: bundled component
  defaults load before app utilities. E12 previously ordered each output only;
  the static entry reintroduced defaults after utilities across files.
- Made StoriesPanel and SettingsNav neutral selected-row treatment explicit. The old accent
  utility was suppressed by native selected-button specificity; the new explicit
  neutral utility preserves the reviewed visual result. Native list resets yield
  to explicit Events margins. All 66 inventoried marker names retain their
  original elements in changed templates.
- Added app-owned `flush` spacing on workbench states and `HomeRow.muted`,
  replacing competing parent/child utility defaults. Explicit hover utilities
  retain fixed backgrounds on floating surfaces and transparent actions.
- Added Styling guidance to root `AGENTS.md` and updated style README with token
  mapping, new-token workflow, and current component ownership.

### Scope and exceptions

- Additional package/style and app-template edits implement the orchestrator's
  important-modifier scope. No package component API or behavior changed.
- E14 documents the existing, temporary story-sizing stylesheet in
  `content-measure.ts`; no new custom CSS was introduced. E3 lists cross-content
  defaults and E7 is confirmed. The Important modifiers table records document,
  motion, intrinsic-sizing and runtime appearance priorities. The sole app
  utility modifier remains on the Shiki background override.
- `main.pcss` and removed component-stylesheet imports have no source consumers.
- Standalone/peer comparison uses actual SSR-rendered shared controls and
  representative native panel markup, in light/dark and normal/hover/focus states.
  System fallback font is held constant there; full book captures cover Manrope.

### Validation

- Source guard: 3/3 pass after its demonstrated initial failure.
- `pnpm --filter @histoire/controls test`: 24 files / 90 tests pass.
- `pnpm --filter @histoire/vue test`: 155 files / 774 tests pass. One refresh
  hit the existing dynamic-list focus assertion in jsdom; immediate full rerun
  passed without source changes.
- `pnpm --filter histoire test`: 405 files / 2,086 tests pass; one file / two tests
  skipped by existing configuration.
- Scoped ESLint and `git diff --check`: pass.
- Full controls/app build commands hit inherited declaration errors, including
  `Module '"vue"' has no exported member 'ref'`. Separate Vite, peer CSS, app CSS,
  copy and Vue3 static-book builds pass.
- Root vue-tsc entry is unavailable (`Command "vue-tsc" not found`). Invoking the
  installed controls-package binary reaches the existing workbench declaration
  errors (`Module '"vue"' has no exported member 'computed'`). No installation.
- Initial root lint scan was interrupted without a result.
  Source-only root lint identifies an existing blank-line error in slice 05;
  changed source, documentation and evidence tooling lint pass.
- Full Cypress: 40 specs / 155 tests pass, 5 existing pending tests. Final
  targeted run after the last corrections: 3 specs / 21 tests pass.
- Main screenshot matrix: **104/104 exact**, including targeted recaptures
  after final Events/Settings/Source fixes. Comments: **16/16 exact**. Native
  standalone/peer: **16/16 exact**, covering light/dark, hover/focus, tone props,
  native tree/source states and competing host element resets. A final full
  main sweep and refreshed comments/native fixtures all have zero changed pixels.
- One earlier narrow Search capture failed before app mount. One final narrow
  Nuxt UI capture had a 1,045-pixel header-text alignment difference. Both matched
  on isolated retries against the same respective builds, without code changes.
  Reference images are unchanged.
- CSS receipt: app styles total **267,547 bytes**, down from **269,418 bytes**
  in integration 10; CSS exports resolve. Full details and commands:
  [evidence report](evidence/report-11.md).

- Final embed integration: **78 pass / 17 fail**. Nine failures match baseline;
  eight extra cases failed binding local servers (`EADDRINUSE` / `EACCES :1`).
  Fresh-process rerun of their five files: **13/13 pass**. Effective remaining
  failures match the same nine baseline cases. Earlier extra dropdown-reopen
  failure also passed its isolated retry.
- Final Tailwind integration: **8 pass / 6 fail**, same six baseline identities.
  [Final failure comparison](evidence/failures-final-11.json).
- Every build, package suite, static-book build and browser session ran under
  `/tmp/histoire-tailwind.lock`; only owned server PIDs were stopped.

### Open issues and handoff

Inherited declaration/type failures, one unrelated slice-05 root lint error,
and nine embed/six Tailwind baseline failures remain. No new unresolved failure
identity. Packed installed-consumer checks remain delegated because they install
packages. Slice 12 conformance/handoff is outside this track. Exact changed paths,
commands, screenshots, CSS sizes and limitations are in the evidence report.
