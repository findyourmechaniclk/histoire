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

Not started.
