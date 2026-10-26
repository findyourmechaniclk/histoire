# 03 — `@histoire/app` on Tailwind v4 and theme mapping

## Outcome and prerequisites

Depends on: 02 (lands together with it). The app builds both CSS outputs with Tailwind v4, every `--histoire-*` token is reachable as a theme utility, `dark:` works in embedded hosts. Existing `<style>` blocks keep working untouched (they contain plain CSS and still pass through PostCSS). UI unchanged.

## Owned files

- `packages/histoire-app/package.json` (deps, `build:css`), `postcss.config.cjs`, `postcss-scope-wrapper.cjs`; delete `tailwind.config.cjs`.
- `src/app/style/main.pcss` → `main.css`; new `src/app/style/theme.css`; `src/app/style/README.md` (document the theme mapping).
- `src/bundle-main-dev.js` (imports `main.pcss`).
- `packages/histoire/src/node/alias.ts` (`getHistoireStyleFiles`, `HISTOIRE_DEV` path).
- Repo root `postcss.config.cjs` if `HISTOIRE_DEV` routes app CSS through it (step 6).
- The 7 files in [inventory: already on utilities](inventory.md#already-on-utilities): prefix rewrite only.
- `histoire-controls/src/style/tailwind-defaults.spec.ts`: add the app entry case (shared with 02).

## Tests first

1. Defaults guard (from 02) compiles the app entry: no `--tw-*` rule outside `.htw\:` selectors; `@property` rules end up outside `@scope`.
2. Theme coverage check, as a node test next to the guard: compile a candidate list containing one utility per theme entry (`bg-surface`, `px-pane-gutter`, `h-control`, `rounded-control`, `shadow-popover`, `ease-histoire`, `animate-skeleton-pulse`, `font-mono`, `text-primary-500`) and assert each produces a rule that references the matching `--histoire-*` variable. Guards against silently dropped theme keys; not a presentation test.

## Implementation steps

1. Deps: package-local `tailwindcss@^4.3`, `@tailwindcss/postcss`, `@tailwindcss/cli`, `@tailwindcss/typography` v4-compatible release. Remove `postcss-import` (and its custom resolver), `tailwindcss/nesting`, `autoprefixer` from the app chain.
2. `main.css` per [architecture: entry stylesheet](architecture.md#entry-stylesheet), package CSS imported into `layer(components)`. Keep existing imports in the same order (floating-vue, controls CSS, controls `floating.pcss`, `controls.css`, `document.pcss`, `fonts.pcss`, histoire-vue `style.css`, `tokens.pcss`). v4 resolves package exports itself; drop the custom resolver and confirm `@histoire/controls/src/style/floating.pcss` still resolves.
3. `theme.css` per [architecture: theme mapping](architecture.md#theme-mapping-srcappstylethemecss). Port the typography `DEFAULT` overrides from today's config (links, heading margins, blockquote incl. `.dark &` → dark variant, `li`, inline `code`), and the `.htw-prose` header-anchor rule from `main.pcss` into `htw:prose` customization. Grep root-config extras (`!sm` screens, `cursor-ew-resize`, `transition-border`) and port only what is used.
4. `postcss-scope-wrapper.cjs`: hoist `@property` rules and the `@layer theme, base, components, utilities;` order statement out of the `@scope` block, next to the existing `@import` hoisting. `@keyframes` and `@layer` blocks stay inside. Add a node test case to the guard if hoisting logic changes.
5. Rewrite the 7 files' classes to `htw:` form (same procedure as 02 step 4). `StoryVariantGridSandbox*` mechanical only.
6. `HISTOIRE_DEV` source mode: `alias.ts` points the user project's Vite at `app/style/main.pcss`, so it is processed by whatever PostCSS config that Vite run finds (repo root `postcss.config.cjs`, Tailwind 3). Either point `HISTOIRE_DEV` at the built `dist/style.css` too, or make the root config route files under `packages/histoire-app/src` and `packages/histoire-controls/src` through `@tailwindcss/postcss`. Prefer the first if `watch` builds already produce `dist/style.css`; record the choice.
7. `dark:` variant: confirm `dark.ts` still sets `htw-dark` (plain class, not a utility) and that embedded providers with `data-histoire-appearance="dark"` now trigger `htw:dark:*`. The 11 existing `dark:htw-` usages become `htw:dark:`; check each still makes sense under the wider selector.
8. Leave all `<style>` blocks and component `.css` files untouched. They hold plain CSS; v4 PostCSS passes them through. Verify one file each with nesting, `@container`, `:deep()` still compiles.

## Failure paths

- Opacity on alpha-carrying tokens (`accent`, `accent-soft` set `--histoire-*-alpha`): v4 `color-mix()` must still multiply alpha. Compare `htw:bg-accent/15` computed color before/after in the browser.
- `@scope` + cascade layers: if app utilities lose to unlayered app SFC CSS that previously sat in the same unlayered space, specificity changes appear only after migration. Note any hit; slices 05–10 remove the SFC CSS anyway.
- Bundle size jump: v4 emits theme variables only when used; check `--htw-*` count in output.

## Validation commands

All of [validation.md](validation.md#per-slice-commands), `test:embed:integration`, `test:tailwind:integration`. Full browser matrix against baseline, including coexistence stories and embedded dark.

## Acceptance criteria

App and controls on v4; full browser matrix matches baseline; embedded dark applies `htw:dark:` utilities; theme coverage test green.

## Non-goals

Converting `<style>` blocks (05–10), shrinking global CSS (11).

## Status

Implemented 2026-10-25, uncommitted; validated jointly with slice 02.

Landed:

- `main.css` replaces `main.pcss`; v4 CSS-first theme imports, package CSS in
  components layer, no preflight, explicit controls source scan and typography.
- `theme.css` maps all semantic colors (including measure variants), primary /
  gray shades, fonts, density spacing, radii, shadows, easing and skeleton
  animation. Existing token definitions and all 136 app style blocks remain.
- Prefix migration of the seven listed components; named groups preserve the
  prompt / legacy variant interactions. Marker classes remain on their nodes.
- Scope wrapper runs after expansion and hoists global `@property` rules and
  layer-order statements. Existing nested CSS, container queries and Vue deep
  selectors continue through the app Vite build.
- `getHistoireStyleFiles` and `bundle-main-dev.js` use built CSS during source
  development. Generated layers are normalized and unwrapped so external v3
  compilers cannot reject them and host preflight cannot override chrome.
- Theme/opacity compilation, external v3 consumption and source-dev URL
  contracts have focused tests. Real-browser coexistence probe is checked in at
  `evidence/probe-v4.mjs` for dark host, opacity and v3/v4 composed effects.

Deviations:

- Pointing source-dev aliases at built CSS alone was insufficient: root v3
  rejects built v4 layers with `@layer utilities is used but no matching
  @tailwind utilities directive is present`. The shared compiler normalizes and
  unwraps emitted layer blocks, preserving utility-after-default order.
  Regression coverage uses the real v3 compiler, without workspace path guards.
  Root PostCSS config remains unchanged.
- Used shared PostCSS builder because v4 CLI cannot run scope plugins. Existing
  installed unused legacy PostCSS dependencies remain untouched with the
  orchestrator-owned lockfile.
- Initial screenshot comparison exposed specificity changes when layered package
  CSS met untouched app rules. Layering all components fixed specificity but
  let Nuxt's unlayered preflight override them. E12 therefore preserves the
  original unlayered cascade across app, standalone and peer outputs; a browser
  probe also verifies standalone controls against an unlayered host reset.
- V4 rebases imported font URLs into source directories. The shared standalone
  builder relocates local font URLs to existing `dist/fonts` assets; Vite keeps
  its own asset handling. An emitted-artifact test catches missing font files.
- Shared isolation plugin lives in controls and app resolves it through the
  existing package wildcard export, so copied/source consumers do not require
  an unshipped root helper. Source-dev verification also refreshes emitted
  Histoire JavaScript without deleting its existing runtime artifacts.
- Manual migration of this small literal class set avoided an uninstalled
  upgrade tool. Radius/palette values retain the v3 definitions, rather than
  inheriting changed v4 defaults.

Exceptions: existing E1/E2/E11 implemented; E12 shared with controls. No new
component CSS or app style block added; no component-style conversion attempted.

Validation completed with baseline limits (2026-10-25):

- App Vite bundle, standalone CSS, copied assets, Vue3 (44 stories / 1,098
  variants) and Nuxt UI static books pass. Full app build still stops at baseline
  declaration errors (`Module '"vue"' has no exported member 'createApp'`).
- Final controls / Vue / Histoire tests: 90 / 773 / 2,083 pass. Histoire's final
  retry used four workers after one unrelated worker exit. Bundle uniqueness,
  all theme mappings, v3 consumption, font paths and source-dev URL checks pass.
- Final focused embed check: 8 files / 19 tests pass, including controls,
  content sizing, scoped embeds, Nuxt and source HMR. Full embed run: 44 files /
  84 tests pass, 4 files / 9 tests fail; all are existing baseline visual/host
  failures. Tailwind integration retains baseline 8 pass / 6 fail.
- Lint: zero errors, 39 existing warnings. Diff whitespace check passes.
  Root vue-tsc binary is missing; existing controls binary reports baseline
  workbench missing-export errors. Cypress is blocked by its read-only cache.
- Browser: 104 captures, no browser errors. **99 match exactly**. Five baseline
  references have differing font/layout state; Matrix light/dark reproduce
  exactly with fonts disabled. Three plugin-inspector references reproduce
  fallback chrome but retain a small canvas-region difference in that probe.
  Strict zero-diff visual acceptance remains open; no baseline image changed.
- A narrow Nuxt header initially differed; same-build repeats reproduced both
  states and an ordinary final recapture matched. V3/v4 effects, embedded dark,
  opacity and unlayered host-reset isolation pass in the real-browser probe.
- App bundled CSS: 198,045 to 196,584 bytes. App stylesheet: 104,082 to 115,517
  (+10.99% raw; gzip drops from 14,505 to 13,896). Native property/nesting output
  explains raw growth; no static whole-palette emission.

Exact files, commands/results, diagnostics, known limits and screenshot links:
[joint report](evidence/after-03/report.md). Orchestrator follow-up: review the five
reference-state images, resolve baseline declaration/test environment failures,
and run installed-consumer checks where dependency installation is allowed.
No files staged, committed or pushed.
