# Architecture: Tailwind v4 setup and conversion rules

## Current state (2026-10-24)

- Tailwind 3.4 from the workspace catalog (`pnpm-workspace.yaml:10`). App config `packages/histoire-app/tailwind.config.cjs` extends root `tailwind.config.cjs`: `prefix: 'htw-'`, preflight off, `darkMode: 'class'` (`.htw-dark`), `experimental.optimizeUniversalDefaults`, colors rebuilt from `--_histoire-color-*` and `--histoire-<name>-rgb` channels, `@tailwindcss/typography` with custom `DEFAULT` styles, `!sm`-style max-width screens.
- App PostCSS (`packages/histoire-app/postcss.config.cjs`): `postcss-import` (custom resolver) → `tailwindcss/nesting` → `tailwindcss` → `autoprefixer` → `postcss-scope-wrapper.cjs`, which wraps every file in `@scope (:root) to (.__histoire-render-story:not(.__histoire-render-custom-controls))`.
- Two outputs: `dist/style.css` (Tailwind CLI, `build:css`, entry `src/app/style/main.pcss`) and `dist/bundled/app.css` (Vite, picks up the PostCSS config for every SFC style block and imported `.css`). `packages/histoire/src/node/alias.ts:16-17` (`getHistoireStyleFiles`) loads `main.pcss` directly under `HISTOIRE_DEV`.
- Controls (`packages/histoire-controls`) run their own Tailwind 3 with the same prefix: `dist/style-standalone.css` (`src/style/main.css`) and `dist/peer/style.css` (`src/style/peer.css`, `tailwind.peer.config.cjs`). The app imports `@histoire/controls/dist/index.es.css` and `src/style/floating.pcss`, and scans controls source.
- `packages/histoire-controls/src/style/tailwind-defaults.spec.ts` guards against universal `--tw-*` resets that would break story Tailwind 4 utilities in shared documents.
- Dark mode: `.htw-dark` on `<html>` (`src/app/util/dark.ts:21-30`, `standalone/document.ts:14,26`) or `[data-histoire-appearance="dark"]` (`histoire-vue/src/provider/HistoireProvider.ts:175`). Tailwind `dark:` only knows the class, so it never applies when embedded.

## Target setup

### Packages and build

- `tailwindcss@^4.3` and `@tailwindcss/postcss` as package-local devDependencies of `@histoire/app` and `@histoire/controls`; `@tailwindcss/cli` for the `build:css` scripts. Remove `postcss-import`, `autoprefixer`, `tailwindcss/nesting` from those PostCSS chains (v4 inlines imports, handles nesting and prefixing through Lightning CSS).
- `postcss-scope-wrapper.cjs` stays last in the app chain. It must also wrap v4 output: verify `@layer` blocks and `@property` rules (see coexistence below; `@property` cannot live inside `@scope` and must be hoisted).
- `@tailwindcss/vite` is not used: SFC style blocks disappear, and the PostCSS route keeps one pipeline for Vite and CLI builds.
- Root `tailwind.config.cjs` and the catalog entry stay on v3 for docs and examples.

### Entry stylesheet

`src/app/style/main.pcss` becomes `main.css`:

~~~css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) prefix(htw);
@import "tailwindcss/utilities.css" layer(utilities) prefix(htw);
@source "../../../../histoire-controls/src";
@plugin "@tailwindcss/typography";
@custom-variant dark (&:where(.htw-dark, .htw-dark *, [data-histoire-appearance="dark"], [data-histoire-appearance="dark"] *));
@import "./theme.css";
/* existing imports: floating-vue, controls, document reset, fonts, histoire-vue styles, tokens */
~~~

No `tailwindcss/preflight.css`. Theme variables are emitted as `--htw-*`, so they never collide with a story's `--color-*` or `--spacing`.

Package CSS (floating-vue, controls, histoire-vue `style.css`) is imported with `layer(components)`. Unlayered CSS beats every layer, so without this, `@histoire/vue` / controls defaults would override app utilities passed through class hooks (slice 04). `document.pcss` keeps its own `histoire-document-reset` layer, declared first in the order statement. Package CSS shipped standalone to embed consumers is unaffected.

### Theme mapping (`src/app/style/theme.css`)

One `@theme inline` block maps existing tokens. Token definitions stay in `tokens.pcss` / `density.css`; the theme only references them, so user theming through `--histoire-*` keeps working.

| Tailwind namespace | Source | Example utility |
|---|---|---|
| `--color-<semantic>` | `rgb(var(--histoire-<name>-rgb) / var(--histoire-<name>-alpha, 1))` for every name in today's `semanticColors` list | `htw:bg-surface`, `htw:text-muted`, `htw:border-border/60` |
| `--color-primary-*`, `--color-gray-*` | `rgb(var(--_histoire-color-<c>-<k>))` | `htw:text-primary-500` |
| Default palette colors | kept minus grays (today's `excludedDefaultColors`) | `htw:text-red-600` |
| `--font-sans`, `--font-mono` | `var(--histoire-font-sans, …)` | `htw:font-mono` |
| `--radius-control`, `--radius-button`, `--radius-panel` | `var(--histoire-radius-*)`; existing `sm..3xl` overrides from root config | `htw:rounded-control` |
| `--shadow-toolbar`, `--shadow-canvas-toolbar`, `--shadow-popover`, `--shadow-panel` | `var(--histoire-shadow-*)` | `htw:shadow-popover` |
| `--ease-histoire` | `var(--histoire-ease)` | `htw:ease-histoire` |
| `--spacing-pane-gutter`, `--spacing-pane-row-inset`, `--spacing-pane-header`, `--spacing-inspector-gutter`, `--spacing-control`, `--spacing-control-padding`, `--spacing-control-gap`, `--spacing-control-margin`, `--spacing-row-<list>` for each row padding token | `var(--histoire-*)` from `density.css` | `htw:px-pane-gutter`, `htw:h-control`, `htw:py-row-test` |
| `--animate-skeleton-pulse` + `@keyframes` | from `WorkbenchLoadingSkeleton.vue:25` | `htw:animate-skeleton-pulse` |
| typography `DEFAULT` | port of today's custom `typography` extension (links, headings, blockquote, li, code) as `@utility` overrides or plugin options | `htw:prose` |

Semantic opacity modifiers compile to `color-mix()`; with the channel-based source color this matches today's `rgb(... / calc(alpha * opacity))` output closely enough, but slice 03 checks alpha-carrying tokens (`accent`, `accent-soft`) explicitly.

Root-config extras to carry or drop: `!sm` max screens become built-in `max-sm:`/`max-md:`; `cursor-*` and `transitionProperty.border` extensions only if used (grep in slice 03).

### Coexistence with story Tailwind

Histoire CSS shares documents with story CSS (merged sandboxes, teleported overlays in dev). Story Tailwind may be v3 or v4.

- v4 uses `@property --tw-*` registrations and, for browsers without `@property`, an `@supports` fallback `@layer properties { *, ::before, ::after, ::backdrop { --tw-…: initial } }`. That universal rule is exactly what `optimizeUniversalDefaults` avoided in v3. Slice 02 ports `tailwind-defaults.spec.ts` to compile v4 output and assert no rule outside `.htw\:` selectors sets `--tw-*`; if v4 emits the fallback, a small PostCSS step drops or rescopes it.
- `@property` registrations are document-global and identical across v4 builds; duplicate registration is harmless. They must stay outside `@scope` (scope wrapper hoists them).
- Cascade layers: app utilities live in `@layer utilities` inside `@scope`. Story styles are excluded from the app subtree by the scope `to` bound only in one direction; unlayered story CSS leaking into app chrome (teleported overlays) would beat layered app utilities. Slice 02/03 spike with `examples/nuxt-ui` (Tailwind 4) and `examples/vue3` (Tailwind 3) and records the outcome in [exceptions.md](exceptions.md) if a mitigation is needed.

## Conversion rules

Apply in order; the first that fits wins.

1. **Marker classes stay.** Classes in [inventory.md](inventory.md#marker-classes) stay on the same element, unstyled. Other semantic classes are deleted once no style, JS or test uses them.
2. **Plain declarations → utilities on the element.** Use theme utilities for tokens (`htw:bg-surface`, `htw:px-pane-gutter`); arbitrary values only for one-off numbers (`htw:w-[248px]`). Never hard-code values a token exists for.
3. **Own state → data attributes + variants.** `htw:data-[state=open]:…`, `htw:aria-selected:…`, `htw:disabled:…`, `htw:has-[:checked]:…`. Replace `.is-*` state classes with data attributes unless the class is a marker (`.is-selected` stays as marker and also gets a data attribute for styling).
4. **Parent state → named groups/peers.** `htw:group/frame` on the parent, `htw:group-data-[selected=true]/frame:…` on children. Name every group; never rely on an unnamed `group` across component boundaries.
5. **Child app component styled from parent → prop or variant on the child.** E.g. `BaseOverflowToolbarItem` menu presentation becomes a `presentation` prop/provide read by toolbar items, not `:deep(.toolbar-action-label)`.
6. **Other-package component → source fix (slice 04).** Prop, variant, slot or class passthrough in `@histoire/vue` / `@histoire/controls`. The app passes utilities through those hooks.
7. **Content the app does not own → arbitrary descendant variants on the nearest owned element.** Only for `v-html` markdown, plugin mount content, Shiki lines, `<iframe>` children of a frame shell: `htw:[&_pre]:…`, `htw:*:pointer-events-none`. Prefer `htw:prose` for markdown.
8. **Container queries.** `htw:@container/<name>` on the container; `htw:@min-[480px]/<name>:…` or `htw:@max-[…]:…` on descendants. Container breakpoints that repeat get `--container-*` theme entries.
9. **Media.** `htw:motion-reduce:…`, built-in or arbitrary breakpoints (`htw:max-[1099px]:…`).
10. **Runtime values.** Inline `:style` bindings (replaces `v-bind()` in CSS). Local custom properties consumed by descendants: `htw:[--histoire-icon-button-size:24px]` on the element, or `:style`.
11. **Generated content.** `htw:before:content-[''] htw:before:…` for separators and status dots.
12. **Repetition.** If the same utility set appears on 3+ elements, extract a small component (or reuse an existing one). No shared CSS class, no `@apply`.
13. **Everything else → exception.** Add an entry to [exceptions.md](exceptions.md) with file, selector, why no rule above works. Reviewer must agree.

Scanner rules: every class name appears literally in source. Map dynamic values through objects of complete class strings (`{ ok: 'htw:text-accent', fail: 'htw:text-danger' }`), never string interpolation. Class strings in `.ts` files under `src/` are scanned automatically; files outside need `@source`.

`:deep()` replacement summary: rules 5–7. A `:deep()` into an app component is rule 5, into another package rule 6, into foreign content rule 7.

## Folder slice procedure (05–10)

Every folder slice follows the same loop per file, in the order its slice lists (shared children before parents):

1. Read the `<style>` block and every template element it targets. Note marker classes ([inventory](inventory.md#marker-classes)) and classes read by JS in the same component.
2. Move each rule onto its element per the [conversion rules](#conversion-rules). Delete the class from the template when nothing else uses it.
3. Switch cross-package rules to the hook from slice 04's table.
4. Remove the `<style>` block (or the imported `.css` file and its `import`). No empty `<style>` left.
5. Compare in the browser against baseline for the screens that show the component (light, dark, compact, 375 px where relevant). Fix diffs before moving on.
6. Record in the slice status: files done, exceptions added (with reason), intentional diffs.

Per slice, before closing: `grep -l '<style' <owned folders>` returns nothing; `pnpm --filter @histoire/app build`, vue-tsc, eslint on changed files, `pnpm --filter @histoire/vue test`, the class-selector suites if the slice touched a marker element; full matrix rows for its screens.

Files stay under 300 lines. If moving styles into a template pushes a component over, split it by responsibility (sub-component), not by moving classes into constants.
