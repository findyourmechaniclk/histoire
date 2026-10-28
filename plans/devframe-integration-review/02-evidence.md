# Slice 02 evidence

## Result

`project.inspect` exposes isolated `variant`, `dom`, `aria` and `diagnostics` reads with an explicit `dev` or `preview` source. Source publication and execution lane are captured before enqueue; admission and both successful and failed completion are checked against the captured source after cleanup. Cancellation and unconfirmed cleanup retain precedence over stale ownership. Input and AbortSignal validation happen before admission. Results are detached before adding metadata and applying the existing complete-result budget.

MCP retains its four tool identities, schemas, operation retention and ARIA snapshot behavior. Browser-safe state and DOM readers now live in `@histoire/shared/inspection`; the DOM reader also accepts an element root with `:scope`. Existing capture keeps its source precedence and its runtime-owned browser setup lease.

## Checks

Commands below ran from `packages/histoire` with Node 24.16.0 first in `PATH`. Browser and loopback checks ran with elevated sandbox access. The integrated package builds were coordinated serially with other agents.

- Baseline before extraction: `node ./node_modules/vitest/vitest.mjs run src/node/__tests__/mcp/inspection-browser.spec.ts src/node/__tests__/embed/node-capture.spec.ts` — 2 files, 15 tests passed.
- Public Node browser: `node ./node_modules/vitest/vitest.mjs run --config vitest.embed.config.ts src/node/__tests__/embed/integration/node-inspection.spec.ts` — 1 test passed on the integrated build. Exercises four readers, explicit dev and built static source selection, invalid selector and signal, queued and running cancellation with subsequent reuse, queued source publication replacement and recovery, and revision rejection.
- MCP browser and transport: `node ./node_modules/vitest/vitest.mjs run --config vitest.mcp.config.ts src/node/__tests__/mcp/integration/inspection.spec.ts` — 2 tests passed on the integrated build. Covers all four operations over dev HTTP, copied Node artifact and stdio, including bounded DOM and invalid selector.
- Focused source checks: `node ./node_modules/vitest/vitest.mjs run src/node/__tests__/embed/node-inspection-ownership.spec.ts src/node/__tests__/embed/node-inspection-result.spec.ts src/node/__tests__/embed/node-inspection-input.spec.ts src/node/__tests__/mcp/inspection-lifecycle.spec.ts src/node/__tests__/mcp/inspection-scoped.spec.ts src/node/__tests__/embed/node-capture.spec.ts` — 6 files, 12 tests passed. Lifecycle tests use the real scheduler and inspection task with a controlled Playwright boundary. Ownership tests use the real scheduler and controlled task callbacks.
- `./node_modules/.bin/tsc --noEmit --pretty false` — passed in `packages/histoire`. Scoped ESLint over slice 02 files passed. `git diff --check` passed before this receipt.
- Existing `inspection-browser.spec.ts` passed 12 tests after concurrent runtime changes were repaired, as reported by the live SDK agent.

## Failure sensitivity

Before the ownership fix, a held-cleanup regression failed because the old source's failure escaped instead of `RUNTIME_CHANGED`. After the fix, stale success and failure reject after cleanup, while explicit cancellation and unconfirmed cleanup retain their own errors.

A temporary isolated copy of the result adapter and its test passed unmodified; replacing `structuredClone(output)` with a shallow copy made the diagnostic-entry preservation assertion fail. The first ARIA-only fault probe survived because its snapshot is a primitive string; a diagnostic array case was added to expose the actual aliasing defect. No fault was injected into the shared checkout.

## Limits

The held source replacement during cleanup is tested at the scheduler/ownership boundary with controlled callbacks, not by forcing an actual browser to fail teardown at that moment. Timeout and unconfirmed cleanup are tested with the real task and scheduler against a controlled Playwright boundary. The standalone packed-consumer MCP suite was not run as part of this slice; final package and wider conformance gates remain separate. No live-session semantics are claimed by these checks.
