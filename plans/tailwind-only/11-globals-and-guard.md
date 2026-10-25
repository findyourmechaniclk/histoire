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

Not started.
