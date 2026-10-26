# Exceptions: custom CSS allowed to remain

Every CSS rule left in `packages/histoire-app` after slice 11 has an entry here. A slice adds an entry only after the [conversion rules](architecture.md#conversion-rules) fail, with file, selector and reason; the reviewer of that slice signs off in its status section. Entries marked *candidate* are expected but not yet proven necessary.

## Expected

| # | File | What | Why not utilities | Owner |
|---|---|---|---|---|
| E1 | `app/style/main.css` | `@import`, `@layer`, `@source`, `@plugin`, `@custom-variant` | Tailwind v4 configuration itself | 03 |
| E2 | `app/style/theme.css` | `@theme inline` token mapping, `@keyframes skeleton-pulse`, typography overrides | Tailwind v4 configuration itself | 03 |
| E3 | `app/style/tokens.pcss` | `--histoire-*` light/dark definitions, root typography/color, descendant code/form fonts, focus/selection/placeholder/scrollbar defaults, reduced-motion reset | Public theming API plus defaults spanning native controls, plugin content and workbench roots. Descendant defaults use `:where()` roots so utilities override them; reduced-motion duration overrides must beat arbitrary animations | 11 |
| E4 | `app/style/density.css` | Density token defaults on `.histoire-provider` and compact overrides on `.histoire-shell-layout[data-density="compact"]` | Tokens consumed across package boundaries (controls read `--histoire-control-*`); 17 defaults and 13 compact overrides retain a readable provider reset boundary. Confirmed by slice 05 | 11 |
| E5 | `app/style/document.pcss` | `@layer histoire-document-reset` (box-sizing, borders, inherited font/color) and html/body sizing | No preflight by design: story CSS shares the document; the reset must sit in its own low layer below story utilities | 11 |
| E6 | `app/style/controls.css` | `:scope[data-histoire-controls]` rules with `!important` | Styles the controls iframe document root through the scope wrapper; no element in app templates to put utilities on | 11 |
| E7 | `app/style/main.css` | `.htw-sandbox-hidden { display: none }` unlayered | Confirmed: four runtime mount sites set this marker outside app templates. A `hidden` attribute uses a UA display rule that host CSS can override; preserve marker and final emitted hiding rule | 11 |
| E8 | `app/style/main.css` | `.__histoire-render-story:not(.__histoire-render-custom-controls)` overflow/min-height | Story mount element created by runtime code, not an app template | 11 |
| E9 | `embed/document.css` | Embed iframe html/body sizing, `@histoire/vue/style.css` import | Document-level rules for a standalone embed document | 11 |
| E10 | `app/style/fonts.pcss` | `@font-face` via controls import | Font loading | 11 |
| E11 | `postcss-scope-wrapper.cjs` | `@scope` wrapping and global declaration hoisting | Keeps app styles out of story subtrees while retaining native property registrations | 03 |

## Added by slices

| # | File | What | Why not utilities | Owner |
|---|---|---|---|---|
| E12 | `packages/histoire-controls/scripts/postcss-tailwind-isolation.cjs` | Remove universal fallback and unwrap generated layers with `flatten-tailwind-layers.cjs` | Universal reset breaks story effects; v3 consumes generic layer names, while unlayered host preflight overrides layered app/controls CSS | 02/03 |
| E13 (removed) | `components/base/overflow/BaseOverflowToolbarItem.vue` | No remaining component CSS | Slice 07 moved menu presentation into toolbar consumers through `useToolbarPresentation`; temporary bridge deleted | 05/07 |
| E14 | `app/components/canvas/content-measure.ts` | Temporary story-document sizing stylesheet | Intrinsic measurement must neutralize viewport-sized html/body roots and isolate one live story flow root; the stylesheet is installed and removed with the measurement owner, outside workbench templates | 11 |

E1, E2 and E11 now have implementations. Shared controls `base-theme.css`, generated `theme.css`/`peer-theme.css`, and emitted layer names are compiler configuration, not component styling. See slice statuses for verification and scope deviations.

E4 confirmed by slice 05: keep density definitions in `density.css`. Provider-level
resets are shared with embedded native controls; thirteen compact overrides and
seventeen defaults remain more readable as this existing public-token contract.
No new density stylesheet or component CSS introduced.

Slice 11 audit confirms eight allowed CSS/PCSS files: E1–E10 account for every
file (multiple entries share `main.css`). E4 stays for cross-package density
inheritance. E6 includes controls-root/body overrides, `#app` and custom-control
flow roots, and the hidden runtime mount. E9 contains only its native stylesheet
import and document sizing/overflow. No component stylesheet remains.

## Important modifiers

App templates and TypeScript retain **one** important utility; **345 of 346**
occurrences were removed.
Remaining authored importance groups in the app and audited packages:

| File / selectors | Declarations | Why importance remains |
|---|---|---|
| `app/components/inspector/SourceDrawer.vue`: source `pre` class | `htw:bg-transparent!` (1 utility) | Shiki supplies an inline background. The existing pre-class hook cannot override inline declarations; retain this single property override so the app-owned code surface shows through while standalone highlighting keeps its background. |
| `app/style/controls.css`: `:scope[data-histoire-controls]`, its `body` | Background, color, font family/size/line height, margin, height, min-height, overflow (9) | Controls iframe shares arbitrary story setup CSS; document-root appearance and sizing must survive host resets. No component hook owns these document elements. E6 |
| `app/style/controls.css`: `.htw-sandbox-hidden` in controls document | `display: none` (1) | Runtime discovery mount must remain hidden even when host rules change display. E6/E7 |
| `app/style/tokens.pcss`: workbench descendants under reduced-motion media | Animation/transition duration (2) | User motion preference must override component animations, including utilities. E3 |
| `app/components/canvas/content-measure.ts`: measured story document `html`, `body`, `#app` | Height, min-height, body overflow (3 authored declarations) | Intrinsic sizing temporarily overrides arbitrary story root sizing, then removes the measurement stylesheet. E14 |
| `app/util/controls-document.ts`: received root custom properties | `style.setProperty(..., 'important')` | Validated host appearance values must beat globally imported story theme variables in the controls document. Runtime counterpart of E6 |
| `packages/histoire-vue/src/styles/content.css`: native docs code `pre` | Transparent background (1) | Native docs use the same Shiki inline background contract as SourceDrawer; the containing code surface owns the background. |
| `packages/histoire-vue/src/styles/tests.css`: `.histoire-tests-run-trigger` | Neutral `border-inline-start` separator (1) | The split-button group's two-class border reset otherwise overrides the trigger's one-class rule. This is the existing separator between Run and its menu, not a status accent. |
| `packages/histoire-controls/src/style/floating.pcss`: reduced-motion `.v-popper__wrapper` | Transition disabled (1) | User motion preference must override vendor popover transition rules. |

Runtime mount/iframe geometry and temporary measurement hosts use direct DOM style
bindings under architecture rule 10; they are not component stylesheets.

Package component qualification now uses `:where()`. Zero-specificity peer
font/color resets and native box sizing retain one provider class, protecting
against host element resets without exceeding utility specificity. Explicit
tones retain pressed-state priority; disabled opacity yields to hidden actions.
Static `bundle-main.js` loads bundled defaults before `style.css`, so final app
utilities also win equal-specificity conflicts across files.
