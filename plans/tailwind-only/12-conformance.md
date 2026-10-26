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

Implemented locally on 2026-10-25–26; final validation is recorded in
[conformance.md](conformance.md). Changes remain unstaged and uncommitted.

### Landed

- Audited the complete migration against `acfebdf9`, including new files.
  Removed 14 unused class names across 13 files, preserved marker/capture consumers, documented
  new shared-component slot contracts, and confirmed all changed source files
  remain at most 300 lines.
- Removed unused app/controls `autoprefixer` and `postcss-import` dependencies
  with matching lockfile importer edits. No installation performed.
- Fixed slice 05's blank-line lint error. Generated evidence JSON is excluded
  from ESLint; reusable scripts and authored fixtures remain checked.
- Existing native/effects capture tools accept explicit output paths, keeping
  reviewed baseline and `after-03` evidence untouched.
- Created conformance, source-audit, cleanup and command receipts; full final
  captures and comparisons use the existing locked tooling.

### Deviations and exceptions

- No new CSS exceptions or important utilities. Eight remaining stylesheet
  files match the guard and existing exception register.
- Static-only instruction supersedes the slice's original dev-server step.
  Real v3/v4 static books plus generated-CSS browser probes cover coexistence;
  live-service and installed-consumer gaps remain explicit.
- Small cleanup touches earlier slices, as authorized by the final audit.
  No unrelated `.claude/` files changed; no staging, branch, stash or Git reset.

### Validation and handoff

Final command results, screenshot differences and outstanding baseline limits
are consolidated in [conformance.md](conformance.md), with raw output under
`evidence/logs/12`. No green full-acceptance claim or implicit
waiver for inherited failures is made.

- Final captures: 104 main, 16 comments and 16 native comparisons match accepted
  references. Raw baseline differs only in five known font-corrected screens
  and four Source screens (37 pixels each). No unexplained visual regression.
- Controls: 90 tests; Vue: 774 tests; Histoire: 2,086 tests pass, plus two existing
  skipped tests. Cypress: 40 specs / 155 tests pass, five existing pending.
- Embed: 86 pass / nine baseline failures. Tailwind integration: eight pass /
  six baseline failures. Failure identities match, with no additions.
- Root lint: zero errors / 39 baseline warnings. Source guard and diff check pass.
  Native Vue build and controls peer declarations pass. Complete controls/app
  declaration builds and workbench typecheck retain the documented Vue-export
  failure. Installed-consumer tests remain the orchestrator's explicit skip.
- App CSS totals 267,547 raw bytes / 36,380 gzip, down from 302,127 / 45,635.
  No source files deleted, behavior tests added or CSS exceptions added in slice 12.
