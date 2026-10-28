# 03 — Live browser SDK and runtime inspection

Depends on 01 and stable shared reader contracts from 02. Goal: inspect an already-mounted story through Histoire's managed bridge with no extra mount or direct host iframe DOM access.

## Likely paths

`packages/histoire-sdk/src/{types,session,transport}/`; `packages/histoire-app/src/embed/{commands,view-session,adapters/runtime-frame,adapters/runtime-requests}.ts`; `packages/histoire/src/node/virtual/preview-runtime/`; `packages/histoire-protocol/src/bridge/`. Candidate `session/inspection/index.ts`, embed inspection adapter and `inspection-service.ts` supply examples, but refer to old grid topology. Current `element-inspection.ts`, canvas/mount model and plugin APIs may supersede parts.

## Steps

1. Trace current session, source revision, connection, primary mount, runtime and canvas target from public API to actual iframe. Document how to identify a non-selected mounted target in current canvas, and what is unavailable. Capture exact authority before first await and avoid auto-selecting or remounting.
2. Add finite SDK methods for variant state, DOM and optional highlight, with explicit target and cancellation. Validate and copy inputs; enforce in-flight/byte/time bounds. Validate source policy, capability and current origin intersection at use time, not only initialization.
3. Route requests through the existing authenticated bridge; runtime checks document and target authority before projecting. Preserve the complete applicable bridge identity from slice 01 and the exact request ID end to end, including for cancellation; map it to the runtime document and target without conflating independent connection, mount or document lifetimes. If HMR, reentrant callback, source replacement, target retirement, session disconnect or permission withdrawal occurs, reject old success *and* old error paths after every async boundary.
4. Constrain DOM query to story document/root; reject invalid selectors; preserve event and state ownership. If highlight is supported, remove only the ring owned by that request, including cancellation, supersession, runtime replacement and disposal. Do not change existing canvas selection.
5. Tests reuse current real SDK/embed fixtures. Remove obsolete grid-only paths, ensure technical identifiers using `preview` remain unchanged when required, and never show that term in new UI copy.

## Tests and gate

Demonstrate in a real browser: mutate unsaved value, read exact same value through SDK; isolated read stays fresh; two sessions/targets don't leak; unmounted target is unavailable; old request held during runtime/source replacement or reconnect cannot succeed; an old selection-bound request cannot succeed after leaving and returning to the same target; explicit cancellation releases work; cleanup cannot erase a successor highlight. Exercise distinct-origin host/book with allowed and denied origins, plus same-origin baseline. No browser proof means slice remains incomplete even if unit tests pass.
