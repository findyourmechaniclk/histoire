# Slice 07: isolated Node accessibility evidence

## Behavior

`project.inspect.accessibility` runs an opt-in axe audit in the exact fresh story document on the captured source's execution lane. It checks source ownership after joined cleanup and uses the existing cancellation and quarantine semantics. Result contains detached bounded findings, `mode: isolated`, captured source, target and viewport. Existing `project.inspect.aria` and MCP ARIA retain their snapshot behavior.

The runtime requires explicit boolean `inspection.enabled` and `inspection.accessibility`. It loads the scanner and local optional axe engine only when enabled and resolvable. The Vite server allows the exact scanner bundle directory only; it does not expose the engine package directory or its parent. The engine virtual module is derived from local axe-core 4.14.0 without evaluation: it preserves the license header, validates the exact version and unique global-assignment anchor, and substitutes a local export for that assignment. Missing or malformed input makes the feature unavailable. It never writes `window.axe`.

Two independent Node input review findings were also fixed: explicit `undefined` optional fields now behave like omission, and real AbortSignals with shadowed listener methods use native EventTarget methods. An unexpected subscription failure cancels and joins admitted work.

## Checks

Commands ran from `packages/histoire` with Node 24.16.0 first in `PATH`. Browser tests used elevated loopback access and coordinated built artifacts. Installed local optional engine was axe-core 4.14.0.

- `node ./node_modules/vitest/vitest.mjs run --config vitest.embed.config.ts src/node/__tests__/embed/integration/node-accessibility.spec.ts` — passed after final test cleanup. Real Chromium verifies disabled opt-in, broken `image-alt` finding, a separate good variant, unmatched and invalid selectors, preserved ARIA shape, and a built static audit with distinct source identity and stale revision rejection. It also verifies an initially absent `window.axe` remains absent, an existing getter descriptor is untouched and not invoked, a successor write during delayed engine loading survives, and a failed module load leaves a preexisting descriptor intact.
- `node ./node_modules/vitest/vitest.mjs run --config vitest.embed.config.ts src/node/__tests__/embed/integration/node-inspection.spec.ts` — passed on the integrated build before the final axe wrapper. Covers ready-source optional `undefined`, shadowed signal cancellation before admission, detached queued globals and subsequent execution, plus prior isolated inspection regressions.
- `node ./node_modules/vitest/vitest.mjs run src/node/__tests__/axe-module.spec.ts src/node/__tests__/vite-accessibility.spec.ts src/node/__tests__/mcp/inspection-browser.spec.ts src/node/__tests__/mcp/accessibility-task.spec.ts` — 4 files, 17 tests passed before final builds. Covers malformed/version-mismatched/missing/duplicate vendor anchors, opt-in and missing-engine resolution, narrow permissions, nonce/epoch authorization, task error cleanup and quarantine. The task lifecycle tests use a controlled Playwright boundary, not Chromium.
- `node ./node_modules/vitest/vitest.mjs run src/node/__tests__/embed/node-inspection-ownership.spec.ts src/node/__tests__/embed/node-inspection-input.spec.ts` — 2 files, 5 tests passed before final builds. The shadowed-signal ownership test failed before the fix with `shadowed add` and passed afterward.
- `./node_modules/.bin/tsc --noEmit --pretty false` and scoped ESLint passed before final browser verification.
- A focused normalization regression passed 2 tests after confirming the previous code emitted partial selectors for mixed or nested axe targets. Unsupported paths are now omitted as a whole and counted as truncated; selector syntax itself is not validated.

## Limits

The browser audit proves isolated dev and built static execution, not live SDK or live MCP authorization. Accessibility findings are automated results, not compliance certification. Axe does not provide a reliable accessible name in its returned nodes; names are left absent rather than guessed. A separate name computation would need bounded traversal and story-root containment, including referenced labels and shadow DOM. Unsupported nested axe paths are omitted and reported as truncated. Cleanup failure is covered with a controlled browser boundary; this receipt does not claim a real Chromium teardown failure was induced. Final packed-consumer and wider integrated gates remain separate.
