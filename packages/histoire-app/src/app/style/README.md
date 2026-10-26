# Workbench foundations

`tokens.pcss` implements the supplied C1 light/dark palettes. Tokens live on
`.histoire-app`, `.histoire-workbench`, or `.histoire-root`; a provider's
`data-histoire-appearance="dark"` and the existing `.htw-dark` class both select
dark values. Preview documents retain their own styles.

Use `--histoire-surface`, `--histoire-canvas`, `--histoire-border`,
`--histoire-chip`, `--histoire-input`, `--histoire-text`, `--histoire-body`, and
`--histoire-muted` for neutral surfaces and text. Accent, danger, warning, agent,
measure, and code tokens follow the same `--histoire-` prefix. Each color has an
RGB-channel companion ending in `-rgb` for Tailwind opacity utilities.

Floating elements use `--histoire-shadow-toolbar`, `--histoire-shadow-popover`,
or `--histoire-shadow-panel`. Regular panels use borders. Font families are
provided through `--histoire-font-sans` and `--histoire-font-mono`; `theme.fonts`
can replace either family independently. The generated theme CSS only sets
these font variables on workbench roots.

`fonts.pcss` loads bundled variable Manrope at weights 400–800 and JetBrains
Mono at weights 400–500. Both use Latin/Latin Extended WOFF2 subsets and
`font-display: swap`. Shared controls own the stylesheet and local assets under
`packages/histoire-controls/src/style/{fonts.pcss,fonts/}`; the app's
`fonts.pcss` imports that stylesheet. App copying emits those files to
`dist/fonts/` beside the generated stylesheet, so source development and
published builds resolve the same relative URLs without external font services.
Full SIL Open Font License texts and pinned upstream versions accompany the
font files.

Refresh these assets after updating the Fontsource development dependencies:

```bash
node packages/histoire-app/scripts/generate-fonts.mjs
```

The default palettes match C1 exactly. Customized `theme.colors` shades map to
the existing `--_histoire-color-*` channels in `virtual/workbench-palette.ts`.
Light accent uses primary 500; dark accent uses primary 400. Fixed violet and
measure colors stay independent of project palettes.

## Icons

`@histoire/controls/vue` exports the single `BuiltinIcon` renderer. Its `icon`
prop accepts a bundled Carbon name (prefixed or bare), another Iconify
identifier, or an image URL/path. Known Carbon glyphs and compatibility aliases
render from bundled data without network access; other icon namespaces continue
through Iconify. `size` accepts pixels or a CSS length, while explicit `width`
and `height` can override either dimension.

The Vue-free canonical collection/helper lives in
`packages/histoire-shared/src/icons/`, exposed through
`@histoire/shared/dist/icons/index.js`. `BuiltinIcon` uses this shared data and
registers the collection for user stories that import Iconify directly. The
workbench utility retains compatibility exports, and legacy MDI, Fluent, and
Remix first-party names resolve to Carbon aliases. User-authored story
components keep their own icon integrations.

Add glyphs to `packages/histoire-shared/src/icons/icon-names.json`, then run
from the repository root:

```bash
node packages/histoire-app/scripts/generate-icons.mjs
```

The generator reads the development dependency `@iconify-json/carbon`; browser
code imports only the generated shared `icons/carbon-icons.json`. Carbon glyphs
retain the upstream Carbon icon license alongside the shared data.

Standalone `App.vue` supplies semantic provider roles as references to C1 RGB
channels. This overrides the SDK's generic inline primary-600 accent while
preserving dark primary-400, custom palette alpha, and portable SDK styling.

## Stylesheet ownership

Workbench panes and inspector tabs share `--histoire-pane-gutter` (16px),
defined in `density.css` and retained in compact mode. Use this inset for
headers, filters, content surfaces, and footers. List rows use `htw:px-pane-row-inset` inside the shared gutter so row backgrounds
and controls align.
Place segmented-control spacing on a native container; inline control
wrappers reset their own margins and padding.

`main.css` composes document styles, controls, native Vue surfaces, tokens, and
fonts in their existing order. `document.pcss` owns the standalone document
reset; reusable native surfaces do not import it. The story runtime document
loads the same `main.css` output, which also hides the hidden story mount
(`.htw-sandbox-hidden`). Generated Markdown code blocks use shared native docs styles in
`histoire-vue/src/styles/content.css`; prose compatibility rules live in
`theme.css`.

Native `HistoireStoryTree` variant counts belong to
`packages/histoire-vue/src/styles/navigation.css`, scoped to the provider's
tree. The superseded standalone header, search dialog, command modal, home,
split-pane shadows, and tab/mobile/startup transitions have no current source
consumers; their standalone stylesheet and transition stylesheet were removed.
Current workbench empty/loading states share `WorkbenchStateLayout.vue` and
use literal utility classes. No component stylesheets or Vue style blocks remain.

`scripts/copy.mjs` preserves source assets and shared licensed fonts.
`scripts/watchAndCopy.mjs` removes only the emitted target of an unlinked source
asset or font. Fresh app builds recreate `dist`; build entry paths, aliases,
Tailwind generation, and reusable CSS boundaries remain unchanged.

## Tests

App logic reuses `packages/histoire/vitest.config.ts`; no additional runner or
test environment is required. Foundation checks run with:

```bash
pnpm --filter histoire exec vitest run src/node/__tests__/workbench-theme.spec.ts src/node/__tests__/workbench-icons.spec.ts
```

These tests cover default/custom font variables, color channels and alpha,
semantic accent mapping, all bundled glyphs with networking unavailable, and
legacy alias resolution. Font asset packaging and browser layout are verified
through the app build and example browser validation.

## Tailwind v4 theme

App and controls compile package-local Tailwind v4 with `htw:` utilities and no
preflight. The root Tailwind v3 config remains for docs and example stories.
`theme.css` maps semantic `--histoire-*-rgb`/`-alpha` colors, fonts, radii,
shadows, easing and density spacing to inline theme entries. For example:
`htw:bg-surface`, `htw:bg-accent/15`, `htw:px-pane-gutter`, `htw:h-control`,
`htw:rounded-control`, `htw:shadow-popover` and `htw:ease-histoire`.
The theme emits only prefixed `--htw-*` variables. Host token overrides stay live.

`htw:dark:*` accepts both `.htw-dark` and `[data-histoire-appearance="dark"]`.
Shared controls theme files preserve the v3 palette and radius scale; regenerate
them with `pnpm --filter @histoire/controls generate:peer-theme`.

Vite and `scripts/build-tailwind.mjs` use the same PostCSS pipeline. The latter
also supports `--watch`; source development consumes its built `dist/style.css`
so an example's v3 PostCSS config cannot process the v4 entry. CSS-first inputs
use components/utilities layers; compatibility output unwraps them and emits
utilities last. This preserves existing specificity against unlayered host
resets and prevents v3 consumers from interpreting v4 layer blocks as directives.
The document-reset layer stays first.
The shared isolation step drops only the universal `properties` fallback layer;
`@property` registrations and layer-order declarations stay outside app `@scope`.
Supported browsers therefore need native `@property` support (Tailwind v4's
[Safari 16.4+, Chrome 111+, Firefox 128+ baseline](https://tailwindcss.com/docs/upgrade-guide#browser-requirements)).

## Utility authoring and new tokens

Use literal `htw:` classes in templates, including complete strings for conditional
classes. Public token utilities include:

- Colors: `htw:bg-surface`, `htw:text-muted`, `htw:border-border`, `htw:bg-accent/15`.
- Density: `htw:h-control`, `htw:px-pane-gutter`, `htw:px-pane-row-inset`,
  `htw:py-row-comment`, `htw:p-control-wrapper-padding`.
- Type and shape: `htw:font-sans`, `htw:font-mono`, `htw:rounded-control`,
  `htw:rounded-button`, `htw:shadow-popover`, `htw:ease-histoire`.

To add a public token, define its defaults and dark override in `tokens.pcss`
(or density values in `density.css`), map it in `theme.css`'s `@theme inline`,
then extend `packages/histoire-controls/src/style/tailwind-theme.spec.ts` to
compile its utility and verify the public variable remains referenced.
Do not hard-code a value already represented by a token.

Use package props, variants and class passthrough for package components.
Allowed global styles and necessary important modifiers are documented in
`plans/tailwind-only/exceptions.md`; the app source guard rejects new stylesheets,
Vue style blocks and deep selectors.

Shared empty/loading/error states retain default panel margins. When a parent
owns that spacing, pass `flush` and supply the complete outer margin utilities
(e.g. `flush class="htw:my-6 htw:mx-0"`). This avoids competing with the layout's
default margin classes. Use a child prop/variant for other inherited defaults,
such as `HomeRow`'s `muted` treatment, instead of important modifiers.
