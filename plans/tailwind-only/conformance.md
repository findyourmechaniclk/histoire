# Tailwind-only conformance — slice 12

Final audit against `acfebdf952eeb3e0e5d5cb3bf1acaa85dfecbb5a` (2026-10-25–26).
Changes remain local and unstaged. Packed installed-consumer tests are explicitly
reserved for the orchestrator. No dependency installation was attempted.

## Acceptance gates

- **Pass — source styling boundary.** App Vue files have no style blocks; no
  component stylesheet or deep selector remains. Eight CSS/PCSS files match
  the guard allowlist and E1–E10. E11/E12 describe compiler processing; E14
  describes the existing temporary measurement stylesheet. No exception added
  by slice 12. [Source audit](evidence/source-audit-12.json).
- **Partial — package builds and consumption.** Controls/app use package-local
  Tailwind 4.3.3; root, docs and example consumers retain v3. JavaScript/CSS and
  static-book builds succeed through their asset steps. Native Vue's full build
  and controls peer declarations pass. Complete controls/app declaration
  builds fail on inherited Vue exports/type resolution. Installed-consumer
  verification remains the orchestrator's authorized skip.
- **Pass — package styling ownership.** No app selector reaches into another
  package's owned classes. Native part classes, button tone/block props,
  toolbar presentation and app-owned primitives replace descendant rules.
  Remaining descendant utilities target foreign markdown, Shiki markup or
  runtime-created iframe content.
- **Pass — available static-book matrix.** All 104 main captures match accepted
  references, with no browser errors. Native controls and comments each match
  16/16. Live-only surfaces
  remain outside the baseline's documented coverage.
- **Pass — Tailwind isolation.** Controls tests compile real standalone, peer
  and app outputs, checking property registration and absence of universal
  `--tw-*` resets. Browser effects probe separately exercises transforms,
  rings, shadows, alpha composition, dark appearance and host reset isolation.
- **Partial — marker consumers.** Source consumers were re-grepped and marker
  placement compared with HEAD. Shared component extraction keeps each marker
  on its original native element. Cypress and embed outcomes are recorded below.
- **Pass — CSS size receipt.** Both app outputs and standalone/peer controls
  are measured below. Combined app CSS shrinks 11.4% raw and 20.3% gzip.
- **Pass — repository guidance.** Root `AGENTS.md` documents literal `htw:`
  utilities, theme tokens, package APIs and exception/guard requirements.

Full acceptance is not claimed while inherited declaration/integration failures
or unverified consumer/live-service boundaries remain. No waiver is inferred.

## Slice 12 cleanup and review

Reviewed tracked migration diff plus untracked migration source. All changed
source/test modules remain at most 300 lines. Public prop additions have JSDoc;
shared presentational components now document their slot contract. No utility
names are interpolated or stored in shared class-string constants. Existing
small primitives serve distinct layout/semantic roles; no duplicate utility,
test fixture or component was added.

Removed unused class names only after checking runtime/test selectors,
package CSS, inventory markers and capture scripts. Retained extra capture
hooks even when not named in the original marker list.
[Exact removed names](evidence/cleanup-12.json).

Removed unused `autoprefixer` and `postcss-import` devDependencies from app and
controls, with matching importer-only lockfile edits. Root's v3 dependencies
and transitive resolutions remain. Added output options to the existing native
and effects probes so final evidence never overwrites reviewed references.

Root lint initially included generated JSON snapshots/log receipts, producing
8,925 formatting errors. ESLint now excludes generated evidence JSON while
still checking authored capture scripts and fixtures. The slice 05 blank-line
error was fixed. No source rule was disabled.

No application behavior test added in slice 12: cleanup changes no user behavior.
Existing tests cover source action visibility without losing content and real
extension pointer/focus ownership for both view adapters. Compiler tests cover
package artifacts; they are not evidence of full installed-consumer behavior.
No mutation/fault probe was performed in this slice.

## Validation ledger

Commands, exit codes and durations: build/unit ledger,
integration logs, and capture ledger.
Every build, package suite, example build and browser session uses
`flock /tmp/histoire-tailwind.lock`. Vitest/vue-tsc use
`NODE_OPTIONS=--max-old-space-size=8192`; Node 24.16.0 and pnpm 10.33.0 use
existing launchers under `/tmp/histoire-integration-bin`.

- Controls: 24 files / 90 tests pass.
- Native Vue: 155 files / 774 tests pass.
- Histoire: 405 files / 2,086 tests pass; one file / two tests remain skipped.
- Root `pnpm exec vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json`:
  `Command "vue-tsc" not found`.
- Installed controls `vue-tsc` against that project reaches inherited failures,
  beginning `Module '"vue"' has no exported member 'computed'`.
  Final diagnostic comparison: 1,313 versus 1,309 at baseline. Four new valid
  imports (`computed`, `ComputedRef`, `useSlots`, `Component`) encounter that
  same pre-existing missing-export failure; no new diagnostic kind appears.
  [Exact comparison](evidence/typecheck-12.json).
- Complete controls build reaches inherited `Module '"vue"' has no exported
  member 'ref'`. Complete app build reaches inherited `Module '"vue"' has no
  exported member 'createApp'`. Initial native Vue build lacked controls peer
  declarations; after `pnpm --filter @histoire/controls build:peer:types`, its
  complete `pnpm --filter @histoire/vue build` passes.
- Both example static builds, app Vite/embed/CSS/copy steps and controls peer
  assets pass. Vue3 builds 44 stories / 1,098 variants; Nuxt builds 2 / 22.
- Embed integration: **86 passed / 9 failed**, exactly the nine inherited
  failures, with no additions. Representative failure:
  `Visual testing requires enabled configuration and a ready development source`.
- Tailwind integration: **8 passed / 6 failed**, exactly the six inherited
  failures, with no additions. [Failure identity comparison](evidence/failures-12.json).
- Root `pnpm run lint`: **0 errors / 39 existing warnings**. Comparator CLI
  tests and `git diff --check` pass.
- `pnpm run test:examples` with writable XDG configuration/runtime directories:
  **40 specs pass, 155 tests pass, 5 existing pending**. Existing retry settings
  handled transient attempts. No Cypress assertions or retries were changed.
- Final post-cleanup unit suites pass with the same counts listed above.
  Final unit ledger,
  integration/Cypress ledger.

## CSS sizes

Raw / gzip bytes; final gzip uses Node 24 `gzipSync` at level 6. Baseline
measurements are retained from slice 01. [Machine-readable receipt](evidence/css-sizes-12.json).

| Output | Baseline raw | Final raw | Baseline gzip | Final gzip |
| --- | ---: | ---: | ---: | ---: |
| App `dist/bundled/app.css` | 198,045 | 23,818 | 31,130 | 4,648 |
| App `dist/style.css` | 104,082 | 243,729 | 14,505 | 31,732 |
| Controls standalone | 27,384 | 29,087 | 4,852 | 4,941 |
| Controls peer | 33,074 | 36,908 | 5,514 | 5,820 |

App utility output grows because component declarations move there from bundled
SFC CSS. Combined app output falls from 302,127 to 267,547 raw bytes and from
45,635 to 36,380 gzip bytes. Peer output grows 11.6% raw / 5.5% gzip with v4
theme/property initialization and emitted utilities. Published CSS paths all
resolve locally; this does not replace the skipped installed-consumer tests.

## Visual references and coverage

Main final images: [evidence/final](evidence/final/). Comparison runs both against
untouched baseline and the explicitly accepted references:

- Five font-corrected images from `after-03`: Matrix light/dark and plugin
  inspector light/dark/compact.
- Four Source drawer images from `after-10`: intentional removal of the changed
  line's colored inset edge, with background tint retained.
- Other 95 images use baseline directly.

Reference identities and SHA-256.
Against raw baseline, exactly nine images differ: the five known font corrections
(20,855–27,264 pixels each), and four Source images (37 pixels each). Against
accepted references: **104/104 match, zero changed pixels**.
Raw comparison,
accepted comparison,
native comparison.

First comments invocation failed before capture with `No screens match comments-*`:
Node's command-line preload was not inherited by the wrapper's child process.
Retry passes the preload through `NODE_OPTIONS`:

```sh
flock /tmp/histoire-tailwind.lock env \
  NODE_OPTIONS='--max-old-space-size=8192 --import=/home/akryum/Projects/histoire/plans/tailwind-only/evidence/comments-09/capture.mjs' \
  node plans/tailwind-only/evidence/serve-capture.mjs \
  --out plans/tailwind-only/evidence/final/comments --port 4612 --only 'comments-*'
```

All 16 retry captures succeed and match exactly; no application or fixture
expectation changed. Comments comparison.
Comments fixtures use slice 09's reviewed captures; native controls compare
against preserved pre-slice-11 package styles. These supplement the static book
without claiming a live AI/MCP session or visual-review backend was exercised.

Static-only instruction supersedes slice 12's original dev-server coexistence
step. Both example builds and generated-CSS browser probes cover v3/v4
coexistence; no dev server or reserved port is used. Capture wrappers stop
only their own server PIDs in `finally`.

## Migration deviations retained

- Slices 01–03: static-book baseline replaces unavailable user dev server;
  v4 compilation uses the existing PostCSS route with a shared build helper.
  E12 flattens generated layers, removes only universal fallback resets and
  preserves globally registered properties. Story projects stay on v3.
- Slice 04: native part-class APIs and explicit interactivity/actions props
  follow current package ownership. No application-only alternate renderer.
- Slice 05: shared state/pane/popover primitives; public density reset remains
  CSS under E4. Temporary overflow exception E13 was removed by slice 07.
- Slices 06–07: reuse native frame/sandbox behavior and explicit resize/input
  hooks; overflow presentation belongs to toolbar consumers.
- Slices 08–10: pane/comment/page migrations use shared primitives. Comment
  fixtures supplement unavailable static-book live states. Source edge removal
  is explicitly accepted; source tint remains.
- Slice 11: shared CSS specificity and output import order were corrected;
  345 of 346 important utilities removed. Shiki's inline background requires
  the one remaining `htw:bg-transparent!`. E14 documents measurement lifetime.
- Slice 12: metadata/documentation/unused-marker cleanup above; generated
  evidence excluded from lint, authored tools still linted. No CSS exception.

## Open boundaries and orchestrator handoff

- Repair inherited Vue/vendor declarations and missing root vue-tsc before
  claiming complete package/type builds.
- The dark-utility probe uses provider-shaped browser markup and real compiled
  styles. Native multi-session host isolation remains one of the nine inherited
  integration failures; this probe does not replace that lifecycle coverage.
- Run packed installed-consumer checks outside this no-install sandbox.
- Live AI/MCP, running tests, screenshot setup, populated visual review/dock,
  enabled embed options and all source failure modes lack static-book baseline
  coverage. Existing behavior tests/fixtures do not replace live qualification.
- Controls SFC styles and native `@histoire/vue` CSS intentionally remain;
  this migration targets app component styling only.
- No staged files, commits, branches, stashes, installs or published changes.

## Files and tests

- Created: this report, final capture/reference/comparison directories, and
  source/size/export/cleanup/validation receipts under `evidence/`.
- Changed: app component marker/slot cleanup, app and controls package manifests,
  `pnpm-lock.yaml`, `eslint.config.mjs`, two reusable capture probes, slice 05's
  blank line, slice 12 Status and the plan index. Exact owned paths:
  [files-12.json](evidence/files-12.json); incremental component/metadata cleanup:
  cleanup-12.patch.
- Deleted: none in slice 12. Earlier slices' component stylesheet deletions
  remain part of the complete migration diff.
- Tests added: none. CSS exceptions added: none.
