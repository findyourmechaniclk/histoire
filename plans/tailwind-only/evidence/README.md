# Tailwind migration evidence

Run from repository root. No dependencies are installed by these scripts. Playwright/minimatch resolve through `examples/vue3`; pixelmatch/pngjs resolve through `packages/histoire`.

If shell shims cannot write mise storage, use installed binaries:

```bash
export PATH=/home/akryum/.local/share/mise/installs/node/24.16.0/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=8192
```

## Build and capture

```bash
flock /tmp/histoire-tailwind.lock pnpm run build
flock /tmp/histoire-tailwind.lock pnpm -C examples/vue3 story:build
flock /tmp/histoire-tailwind.lock node plans/tailwind-only/evidence/serve-capture.mjs \
  --out plans/tailwind-only/evidence/current --port 4610
```

`serve-capture.mjs` starts `histoire preview` directly in the selected example, prints its PID, waits for HTTP readiness, runs capture, then stops that PID in `finally`. It forces IPv4 localhost resolution to match capture URLs. Wrap the entire session in the lock. Never use reserved ports 6006/6106. Do not compare against a still-changing build.

When a server is already owned by your locked session, use capture directly:

```bash
node plans/tailwind-only/evidence/capture.mjs --out plans/tailwind-only/evidence/current \
  --port 4610 --only 'inspector-*' --modes light,dark,compact,narrow
```

Quote screen globs. `screens.mjs` defines exact story IDs, routes and actions. Modes: light/dark/compact at 1440×900; narrow at 375×812. Compact uses light appearance. Contexts have DPR 1, reduced motion, en-US locale, UTC timezone and frozen wall time (timers still run). Appearance and density use app persistence; assertions verify application applied both. Capture waits for network quiescence, controls skeletons to disappear, fonts/images, admitted frames and visible plugin audits; animations/carets are disabled during capture.

Each screen/mode uses fresh browser storage. `manifest.json` records suite, base path, routes, browser version, successful captures, failures and browser errors. A partial rerun replaces only matching records and deletes its old PNG before capture, so failed reruns cannot silently reuse stale images. Failures also write a `.failure.txt` with diagnostic page text. Do not accept `captured-with-errors` without inspecting its errors. New suites should add explicit cases and readiness assertions, never inject fake app state to stand in for missing capabilities.

Nuxt UI / Tailwind 4:

```bash
flock /tmp/histoire-tailwind.lock pnpm -C examples/nuxt-ui story:build
flock /tmp/histoire-tailwind.lock node plans/tailwind-only/evidence/serve-capture.mjs \
  --project nuxt-ui --port 4611 --base /_stories/ --out plans/tailwind-only/evidence/current
```

The wrapper defaults to `/` for Vue3 and `/_stories/` for Nuxt UI. Direct `capture.mjs` calls default to `/`; pass `--suite nuxt-ui --base /_stories/` for that example. Records from both suites can share one directory because screen names differ.

Static builds hide dev-only surfaces. Exact coverage and known build limitations are recorded in [baseline.md](../baseline.md); these scripts do not claim skipped surfaces were verified.

## Compare

```bash
flock /tmp/histoire-tailwind.lock node plans/tailwind-only/evidence/compare.mjs \
  plans/tailwind-only/evidence/baseline plans/tailwind-only/evidence/current \
  --out /tmp/histoire-tailwind-diffs
node --test plans/tailwind-only/evidence/compare.test.mjs
```

Flat PNG names are paired across both directories. Output includes diff PNGs and `summary.json` with changed-pixel counts/ratios per screen. Pixelmatch threshold defaults to 0.1; anti-aliased pixels are included. Exit 0 means all pairs match and capture manifests contain no failures; exit 1 means changed pixels, missing captures, different dimensions, or unsuccessful capture records. Empty inputs and invalid options fail. Identical screenshots yield zero ratio; this is repeatability evidence, not proof that every UI state was covered.

`compare.test.mjs` exercises the real CLI against temporary PNGs: unchanged image, one changed pixel out of four, missing/added image, changed viewport and empty inputs. No styles/classes are asserted and no application behavior is mocked.

## Pruned evidence

On 2026-10-26 intermediate captures, diff images, comparison summaries, logs and patches were deleted to keep the pack small. Kept: `baseline/` (pre-migration reference), `after-03/` (font-corrected reference for five screens), `final/` (final captures, incl. `final/comments/` and `final/native/`), `before-09/` (comments fixture reference), the capture/compare tooling, the `comments-09/` fixture, reports (`*.md`) and small JSON receipts. Plan documents still name some deleted files as plain text; rerun the tooling to regenerate them.
