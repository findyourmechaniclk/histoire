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

Completed 2026-10-25 on `main` at `acfebdf9`, with baseline failures and coverage limits recorded.

Landed:

- Reusable `capture.mjs`, `compare.mjs`, shared capture recipes/helpers, PID-owned `histoire preview` wrapper, README and behavioral comparator test under `evidence/`. Every source script is below 300 lines.
- `baseline.md` records clean initial source state, package/type/test results, CSS raw/gzip sizes, screenshot recipes, skipped surfaces and handoff. Full command ledger and named failures are in `evidence/`.
- All 152 inventory rows and bytes match (136 styled Vue files, 16 CSS files); only a localized drift/extra-marker note was added to shared inventory.
- 104 screenshots: 25 Vue3 screens plus Nuxt UI fixture, each in light/dark/compact/375 px modes. Baseline directory 8,372,068 bytes. Final independent comparison: 104 matching pairs, zero detected changed pixels, no missing captures or browser errors.

Deviations and calibration:

- User replaces stale 6006 procedure with static Vue3 on 4610; Nuxt on 4611 uses its actual `/_stories/` base. IPv4 resolution is forced for the CLI's localhost binding. Servers stop by owned PID.
- Root/package builds stop at Vue/vendor declaration errors. Existing asset-only build subcommands complete usable bundles/styles/fonts; both books then build. App's build aliases native Vue/controls source, so captured UI reflects current source. No source/build-config repair attempted.
- Static books hide dev-only tests/AI/MCP/comments/agents/screenshot surfaces. No embedded native host exists in the selected examples. Scope and remaining transform/ring proof gaps are explicit in baseline.
- Implicit variants use `_default`; Markdown catalog uses `.story.js` IDs. Measurement uses an explicitly selected Grid frame. Tailwind 3 coexistence uses the existing Box Shadow token story.
- Initial 11 pixel differences came from loading skeletons, font timing and audit completion order. Network/control/font waits, explicit shipped font-face loading and a single-frame Audit pane eliminated all final differences; calibration evidence retained.

Validation:

- Controls: 82 tests pass. Vue: 773 pass. Histoire: 2,082 pass, 2 skipped.
- Embed integration: 80 pass / 13 fail (8 failed files). Tailwind integration: 8 pass / 6 fail (2 failed files). Every failing outer test is named in `evidence/validation-failures.md`.
- Root/controls/app full builds fail at type generation. Root/app-package `vue-tsc` command unavailable; existing controls binary checks app project and reports 1,309 errors. CSS asset steps and Vue3/Nuxt book builds pass.
- Cypress command attempted; tests cannot start: `EROFS: read-only file system, open '/home/akryum/.config/Cypress/cy/production/cache'`. Skipped under user's sandbox exception.
- Final repository lint: zero errors, 39 existing warnings. Comparator CLI test: pass. Style scan: expected 136 Vue style files. `git diff --check`: clean.

Exceptions: no custom CSS added. No staging, commits, dependency installs, source edits or deletions.

Open findings for orchestrator: build/types and integration failures above; Cypress runtime restriction; uncaptured dev/embedded-host surfaces and dedicated transform/ring coexistence probes. Slice 01 capture/tooling work is complete; no app/style conversion or failure repair was attempted.
