# Slice 04 diagnostics evidence

## Behavior and boundaries

Diagnostics are opt-in and document-wide. A target identifies the subscription context; a console message or error is not proven to originate from that target. The observer records primitive text only, strips URL userinfo, query and fragment, and redacts common named credential forms. Arbitrary unlabelled secrets in user text cannot be reliably detected. Component events remain a separate SDK history and do not enable diagnostics.

One SDK session shares one runtime observation across subscribers. Each subscriber has a `ready` promise, a `closed` promise, and an idempotent `unsubscribe()`. `closed` resolves for explicit unsubscribe and rejects on observation loss or ownership withdrawal. The last unsubscribe sends a captured stop, joins registration settlement, and retries stop if the first attempt raced ahead of registration. It rejects `SOURCE_UNAVAILABLE` if removal cannot be confirmed and `TIMEOUT` if cleanup has not settled after five seconds. Work still settling after timeout remains observed; completion is not claimed. Reentrant successors use distinct observation IDs and captured owners.

Retained evidence is cleared when the SDK observes a loss of source, actor authority or session disposal, and on polling failure. Explicit unsubscribe retains evidence while that authority remains current. Sequence numbers do not restart after clear. `getSnapshot()` is synchronous and cannot refresh remote policy; a broker must reauthorize every call.

## Focused validation

- Protocol debug-buffer and bridge tests passed: bounds, loss, detached snapshots, exact peer and runtime identity.
- SDK `src/__tests__/debug-lifetime.spec.ts`: 8 tests passed, including shared subscribers, held registration before and after the first stop, successor isolation, loss notifications, cleanup failure and five-second timeout. `tsc --noEmit` passed.
- Runtime `src/node/__tests__/inspection-debug-lifetime.spec.ts`: 4 tests passed, including overlapping observations, reentrant restart, peer isolation, rate loss, safe text projection, and console restoration.
- `src/node/__tests__/preview-runtime-errors.spec.ts`: 3 tests passed; fatal error sends the document retirement signal before `RUNTIME_FAILED`, while nonfatal ResizeObserver notices do not.
- Isolated fault probe: removing the connection identity check made a peer-stop assertion fail; correct source passed. This is not a broad mutation campaign.
- Private real Node GC probes against the actual SDK collector and runtime debug service, with a minimal connected SessionContext, showed collected consumers and disposed contexts while unsubscribed handles remained held. Separate probes covered explicit unsubscribe, automatic retirement and failed registration; a deliberately retained control survived. The initial implementation failed these probes before callback, closure and lazy-error-stack retention were fixed. These probes do not prove real browser or bridge cleanup.

## Browser and remaining checks

A prior coordinated Chromium build passed 3 browser cases: authorized console and nonfatal error observation with shared subscribers and final handler restoration; fatal runtime retirement cleared evidence and restored the handler in a retained iframe; and a cross-origin host with embed permission but no inspection permission was denied. Those results precede the latest joinable-cleanup and `closed` changes and are not exact-tree proof.

`src/node/__tests__/embed/integration/live-diagnostics.spec.ts` now additionally uses real Chromium GC to check that an unsubscribed consumer and disposed public session can be collected while their subscription handles remain held. It samples 300 `console.debug` calls before subscription and after unsubscribe, without a performance threshold. Set `HISTOIRE_DIAGNOSTIC_RECEIPT` to a writable file path to save the timing sample. After the coordinated protocol, SDK, app, Histoire and documentation builds and scoped lint cleanup, the final Chromium gate passed all 3 cases, including real browser GC with a retained unsubscribed handle and a retained automatically retired handle. In one headless Chromium run, 300 `console.debug` calls took 8.0 ms before subscription and 13.9 ms after unsubscribe; both original console functions were restored. These timings are an observation, not a benchmark or proof of absence of all overhead.
