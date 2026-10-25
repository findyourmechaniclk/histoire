# Validation and acceptance

## Per-slice commands

Every slice runs the subset its status section names; slices 02–04 and 11–12 run all of them.

~~~bash
pnpm --filter @histoire/controls build
pnpm --filter @histoire/app build
pnpm --filter @histoire/controls test
pnpm --filter @histoire/vue test
pnpm --filter histoire test
pnpm exec vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json
pnpm run lint
~~~

Class-selector consumers (marker classes must keep matching):

~~~bash
pnpm --filter histoire test:embed:integration
pnpm --filter histoire test:tailwind:integration
pnpm run test:examples
~~~

`test:examples` runs `examples/vue3` Cypress against a static build; record the first run in slice 01 as the effective baseline, since some specs may already be flaky.

Guard (zero after slice 11):

~~~bash
grep -rl '<style' packages/histoire-app/src --include=*.vue
~~~

## Browser matrix

Use the user's dev server at `http://127.0.0.1:6006/` (serves `histoire-app/dist/bundled`, restarts on dist changes; wait for `ss -ltn | grep :6006` before reloading). Compare against slice 01 screenshots in `evidence/baseline/`.

Screens:

1. Home page (needs-attention, browse sections).
2. Canvas: grid, list, matrix (axis bar, inspector), single variant with resize handles, measure hint, status bar hints.
3. Canvas toolbar: inline and overflow menu presentation, screenshot popover, tool switch.
4. Inspector: Props (controls, state presets), Docs, Events (with entries), Tests, Source drawer (changed lines, error).
5. Side panes: stories, search (scopes, no results), tests (tree, running), visual (results, viewer, slider, dock), MCP activity, AI threads.
6. Comments: canvas overlay pins, thread with agent markdown, prompt with attachments and session radio list, questions.
7. Settings: general, agents (rows, forms, state dots), plugins.
8. Markdown docs page with outline.
9. Embed dialog.
10. Plugin surfaces from `examples/plugin-reference`: rail pane, inspector tab, overlay, custom canvas view.

Modes for each screen: light, dark, compact density, 375 px width. Additionally: embedded `@histoire/vue` host (dark via `data-histoire-appearance`), and a Tailwind 4 story (`examples/nuxt-ui`) plus a Tailwind 3 story (`examples/vue3`) to check coexistence (story transforms, rings, shadows unchanged; app chrome unchanged).

Differences must be explained in the slice status (intentional rounding, sub-pixel) or fixed.

## Acceptance

- Zero `<style>` blocks in `packages/histoire-app/src/**/*.vue`; component `.css` files deleted; remaining CSS matches [exceptions.md](exceptions.md) one-to-one.
- App and controls build on Tailwind v4; controls standalone and peer CSS still consumable (`histoire/src/node/__tests__/embed/consumers/packages.spec.ts`).
- No `:deep()` or descendant selector from app code into `@histoire/vue` / `@histoire/controls` classes.
- Browser matrix matches baseline.
- `tailwind-defaults` guard passes on v4 output: no `--tw-*` rule outside prefixed utilities.
- All marker classes in [inventory.md](inventory.md#marker-classes) still present; Cypress and embed integration specs pass.
- `dist/bundled/app.css` size recorded before/after (no target; regressions over 10% explained).
- AGENTS.md documents the Tailwind-only rule.
