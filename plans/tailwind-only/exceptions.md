# Exceptions: custom CSS allowed to remain

Every CSS rule left in `packages/histoire-app` after slice 11 has an entry here. A slice adds an entry only after the [conversion rules](architecture.md#conversion-rules) fail, with file, selector and reason; the reviewer of that slice signs off in its status section. Entries marked *candidate* are expected but not yet proven necessary.

## Expected

| # | File | What | Why not utilities | Owner |
|---|---|---|---|---|
| E1 | `app/style/main.css` | `@import`, `@layer`, `@source`, `@plugin`, `@custom-variant` | Tailwind v4 configuration itself | 03 |
| E2 | `app/style/theme.css` | `@theme inline` token mapping, `@keyframes skeleton-pulse`, typography overrides | Tailwind v4 configuration itself | 03 |
| E3 | `app/style/tokens.pcss` | `--histoire-*` light/dark token definitions on `:is(.histoire-app, .histoire-workbench, .histoire-root)` and dark selectors | Public theming API; user themes and `resolved-theme.ts` override these variables by selector | 11 |
| E4 | `app/style/density.css` | Density token defaults on `.histoire-provider` and compact overrides on `.histoire-shell-layout[data-density="compact"]` | Tokens consumed across package boundaries (controls read `--histoire-control-*`); 26 declarations as arbitrary properties on two roots would be unreadable. *Candidate*: slice 05 may move them to arbitrary properties on `ShellLayout` if readable | 11 |
| E5 | `app/style/document.pcss` | `@layer histoire-document-reset` (box-sizing, borders, inherited font/color) and html/body sizing | No preflight by design: story CSS shares the document; the reset must sit in its own low layer below story utilities | 11 |
| E6 | `app/style/controls.css` | `:scope[data-histoire-controls]` rules with `!important` | Styles the controls iframe document root through the scope wrapper; no element in app templates to put utilities on | 11 |
| E7 | `app/style/main.css` | `.htw-sandbox-hidden { display: none }` unlayered | Class set from runtime code outside the content scan; must never be dropped or lose to story layers. *Candidate*: replace with `hidden` attribute if all setters can be found | 11 |
| E8 | `app/style/main.css` | `.__histoire-render-story:not(.__histoire-render-custom-controls)` overflow/min-height | Story mount element created by runtime code, not an app template | 11 |
| E9 | `embed/document.css` | Embed iframe html/body sizing, `@histoire/vue/style.css` import | Document-level rules for a standalone embed document | 11 |
| E10 | `app/style/fonts.pcss` | `@font-face` via controls import | Font loading | 11 |
| E11 | `postcss-scope-wrapper.cjs` | `@scope` wrapping of all app CSS | Keeps app styles out of story subtrees | 03 |

## Added by slices

None yet.
