# Slice 09 isolated comment fixture

Real Vue components, no live agent, no new dependency. Supplements unavailable
static-book comments; does not claim live overlay geometry or server coverage.
Uses existing capture/compare tools, all four theme/density/viewport modes.

The before-source snapshot for this run remains at
`/tmp/histoire-comments-09/app/components/comments`; its hashes are recorded in
`../before-09/source.json`. It was copied before any slice 09 edits. Relative
imports outside comments resolve to the existing checkout through sibling
symlinks. Do not substitute current source when collecting the before set.

Run under the global lock, with installed Node/pnpm binaries available on PATH:

```sh
flock /tmp/histoire-tailwind.lock bash -c '
  pnpm --filter @histoire/app exec vite build --emptyOutDir
  pnpm --filter @histoire/app build:css
  pnpm --filter @histoire/app exec node scripts/copy.mjs
  pnpm --filter histoire-example-vue3 story:build
'
```

The full app build has inherited declaration failures; the recipe builds its
required browser assets separately. `--emptyOutDir` clears obsolete Vite chunks
without removing the other app outputs. Missing dependencies must be reported,
not installed by this track.

For the actual comparison, keep both fixture builds and captures in one lock:

```sh
flock /tmp/histoire-tailwind.lock bash -c '
  set -e
  export NODE_OPTIONS=--import=/home/akryum/Projects/histoire/plans/tailwind-only/evidence/comments-09/capture.mjs
  COMMENTS_SOURCE=/tmp/histoire-comments-09/app/components/comments node plans/tailwind-only/evidence/comments-09/build.mjs
  node plans/tailwind-only/evidence/serve-capture.mjs --port 4613 --out plans/tailwind-only/evidence/before-09 --only "comments-*"
  node plans/tailwind-only/evidence/comments-09/build.mjs
  node plans/tailwind-only/evidence/serve-capture.mjs --port 4613 --out plans/tailwind-only/evidence/after-09 --only "comments-*"
  node plans/tailwind-only/evidence/compare.mjs plans/tailwind-only/evidence/before-09 plans/tailwind-only/evidence/after-09 --out plans/tailwind-only/evidence/diff-09
'
```

The absolute preload path matters: the server child starts in `examples/vue3`.
The runner starts/stops only its own server PID. `build.mjs` defaults to current
source and rebuilds CSS/fonts before bundling the isolated fixture into the
static book. Rebuilding the book removes that fixture; rebuild it before capture.

Cases: combined overview; thread with expanded decision and top-of-log plan;
long markdown with attachments/session choices; questions with focused custom
answer. Serial integration completed all **16 pairs with zero changed pixels**.
See `../diff-09/summary.json` and `../after-10/report.md`.

The fixture supplies the workbench's font tokens, density stylesheet, provider
appearance and controls context. After injecting fixture assets, `build.mjs`
recomputes the static capture identity through the existing production helper;
the static host's integrity validation remains enabled. Before-source snapshot
hashes still match all 52 original files.
