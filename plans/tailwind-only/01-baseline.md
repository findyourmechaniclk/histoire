# 01 — Baseline, screenshots and inventory check

## Outcome and prerequisites

Depends on: none. Records the state every later slice compares against. No source or build-config change.

## Owned files

- [baseline.md](baseline.md), [inventory.md](inventory.md) (drift section only), `evidence/baseline/*`.

## Steps

1. Record HEAD, branch and `git status --short` in [baseline.md](baseline.md). Other work is in flight in the checkout; note which dirty files touch `histoire-app`, `histoire-controls` or `histoire-vue` styles.
2. Build `@histoire/controls` and `@histoire/app`; record `dist/bundled/app.css`, `dist/style.css`, controls `dist/style-standalone.css` and `dist/peer/style.css` sizes (raw and gzip).
3. Run every command in [validation.md](validation.md#per-slice-commands) plus the class-selector consumer suites. Record pass/fail counts and each failing test by name.
4. Capture the [browser matrix](validation.md#browser-matrix) on `127.0.0.1:6006` into `evidence/baseline/<screen>-<mode>.png`. Fixed viewport (1440×900, plus 375×812), animations settled, same story/variant selection per screen. Write the list of screens/modes and how to reach each (URL, clicks) into baseline.md so slice 12 repeats them exactly.
5. Coexistence baseline: one Tailwind 4 story (`examples/nuxt-ui`) and one Tailwind 3 story (`examples/vue3`) with transforms, rings and shadows, in dev and built sandbox. Screenshots into `evidence/baseline/coexistence-*`.
6. Regenerate the inventory tables (same script approach: every `.vue` with `<style>`, every `.css`/`.pcss` under `src`) and record added/removed/moved files in an "Inventory drift" section; assign new files to the slice owning their folder.
7. Re-grep marker class consumers (tests, cypress, `closest`/`querySelector`) and update [inventory.md](inventory.md#marker-classes) if new ones appeared.

## Failure paths

- Dev server on 6006 not running or restarting: wait for `ss -ltn | grep :6006`; do not start a second server on the same examples. The `.claude/launch.json` source-mode config is known broken (postcss export error from `@histoire/vendors`); do not use it.
- Pre-existing test failures: record, do not fix.

## Validation commands

All commands in [validation.md](validation.md#per-slice-commands).

## Acceptance criteria

[baseline.md](baseline.md) complete; screenshot set reproducible from written steps; inventory drift recorded.

## Non-goals

Fixing failures, changing styles.

## Status

Not started.
