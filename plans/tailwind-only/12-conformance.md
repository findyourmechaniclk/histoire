# 12 — Conformance and handoff

## Outcome and prerequisites

Depends on: 11. Evidence that [validation.md acceptance](validation.md#acceptance) holds, recorded in `conformance.md`, with open issues listed.

## Owned files

- `conformance.md` (new), `evidence/final/*`, status sections of this README.

## Steps

1. Run every command in [validation.md](validation.md) on a clean build of controls, vue and app. Compare against [baseline.md](baseline.md): new failures block; pre-existing ones are listed.
2. Repeat the baseline screenshot set exactly (steps written in baseline.md) into `evidence/final/`. Diff image pairs (pixel diff tool or side-by-side); list every difference with cause and decision.
3. Coexistence: Tailwind 4 story (`examples/nuxt-ui`) and Tailwind 3 story (`examples/vue3`) in dev and built sandbox; story transforms, rings, shadows and app chrome unchanged.
4. Embedded `@histoire/vue` host in dark appearance: `htw:dark:` utilities apply.
5. CSS size table: `dist/bundled/app.css`, `dist/style.css`, controls standalone and peer, raw and gzip, baseline vs final.
6. Guard green; exceptions table matches remaining CSS.
7. Marker classes: re-grep consumers; all present.
8. Write `conformance.md`: gate per acceptance bullet (pass/fail/evidence link), deviations per slice, open issues (e.g. controls `<style>` blocks, `@histoire/vue` CSS left plain by design), follow-up candidates.
9. Update README status line.

## Validation commands

All of [validation.md](validation.md).

## Acceptance criteria

`conformance.md` complete, every acceptance bullet passed or explicitly waived by the user.

## Non-goals

Commit, push, publish (separate instruction).

## Status

Not started.
