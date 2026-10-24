# 11 — Frame messaging and SDK integration

## Outcome and prerequisites

Depends on: 03, 10. Workbench plugins and SDK hosts exchange bounded JSON with a specific frame plugin actor, in standalone and embedded modes.

## Owned files

- `histoire-protocol/src/channels.ts`: plugin channel payload `{ pluginId, actorId, type, data }`; reuse size check and `createHostChannelRateLimiter` (`:55-80`) with separate per-plugin accounting.
- `histoire-protocol/src/bridge/`: add `plugin.post` command and `plugin.message` event; `validateHistoireTarget` accepts optional `actorId`.
- `preview-runtime/host-messaging.ts`, `message-handler.ts`: plugin message type; deliver by `actorId`, not selected variant (contrast `runtime-service.ts:41-42`).
- `histoire-app/src/app/extensions/frame-channels.ts` (new): standalone native path relaying through the frame registry (`postToFrame`, `composables/canvas-settings.ts`).
- `histoire-app/src/embed/adapters/channels.ts`: relay plugin messages next to host channels.
- `histoire-sdk/src/session/plugins.ts` (new): `session.plugins.frames()`, `session.plugins.open(pluginId, frameRef)`.
- Descriptor: `histoire/src/node/virtual/embed/descriptor.ts` advertises installed frame-plugin `{ id, apiVersion }`; whitelist in `histoire-protocol/src/bridge/source-descriptor.ts` and capability `framePlugins`.

## Tests first

1. Round trip in standalone, same-origin embed and allowed cross-origin embed.
2. Two frames rendering the same variant never receive each other's messages.
3. Wrong source window, origin, document, actor or plugin id rejected and counted.
4. Actor detach rejects pending posts and removes listeners immediately; nothing replays.
5. Existing host-channel suite passes unchanged.
6. Data-only SDK connection lists frame plugins from descriptor but evaluates no story or UI module.

## Implementation steps

1. Protocol types and validators.
2. Frame side: `FramePluginContext.channel` posts with `pluginId` and `actorId` through `postToParent`.
3. Standalone: host extension routes to `api.frames.open(frameRef)` channels keyed by frame key plus actor.
4. Embed and SDK: wrapper relays over existing port; correlation, cancel and timeout from `runtime-requests.ts`.
5. Keep `embed.channels` host channels separate; plugin traffic never uses channel names.

## API changes

`PluginChannel`, `api.frames`, `session.plugins`, descriptor capability `framePlugins`.

## Failure paths

Unavailable plugin, retired actor, unsupported version, disconnected source each reject distinctly. No implicit frame creation or retargeting.

## Validation commands

~~~bash
pnpm --filter @histoire/protocol test
pnpm --filter @histoire/sdk test
pnpm --filter histoire build
pnpm --filter histoire test:embed:integration
~~~

## Acceptance criteria

Inspector plugin exchanges data with the selected frame's actor; menu-invoked action addresses its captured frame.

## Non-goals

Broadcast to all frames; message replay.

## Status

Landed 2026-10-23 (uncommitted).

- Protocol: `src/plugin-channels.ts` (payload/notice validation, `isHistoirePluginId`, `validateFramePluginInventory`, `createPluginChannelLimiters` = per-plugin pair of `createHostChannelRateLimiter`, sizes through `measureWireValue`). Bridge `plugin.post` (runtime command, data port refused) and `plugin.message` (primary, child-to-parent, exact runtime/story, like `channel.message`); 64 KiB limits. `HistoirePluginChannelPreviewMessage`; `RUNTIME_REQUEST` command `plugin.post`. Descriptor field `framePlugins` (whitelisted in `source-descriptor.ts`) and optional capability `framePlugins`.
- Frame runtime: `preview-runtime/frame-plugin-channels.ts` (new, emitted by `frame-plugins.ts`) replaces the stub. Per-attachment channel; per-plugin limiters per document; `histoire:attached` posted after `attach` settles, `histoire:detached` after cleanups, `histoire:error` for load/attach/cleanup failures (closes slice 10 TODO). Inbound delivery by `actorId` through direct `HOST_CHANNEL_MESSAGE { plugin }` (`message-handler.ts`) and correlated `RUNTIME_REQUEST plugin.post` (`runtime-service.ts`); listeners cleared at detach.
- SDK: `session/plugin-hub.ts` (shared host core: actor registry from notices, delivery by actor, per-document accounting, retirement rejects pending posts at once and aborts their request), `session/plugins.ts` (`session.plugins`), wiring in `context.ts`, `notifications.ts`, `controller.ts`, `adapters/types.ts`, `transport/port.ts`, `types.ts`; hub exported from `@histoire/sdk/internal`.
- Embed wrapper `adapters/channels.ts`: plugin bodies relayed as `plugin.message` with own per-plugin limiters; installed-plugin, document, story, catalog and readiness checks (detach/error notices pass without readiness).
- Standalone `extensions/frame-channels.ts`: `registerFrames(registry, window)`; inbound only from a registered frame's window, origin and current document; outbound via `postToFrame`; `decorate(context)` adds capability `frames` and the frame service. `create-workbench-host.ts`: three wiring lines plus `frames` on `WorkbenchHost` and optional `framePlugins` option (defaults to `session.plugins.frames()`).
- plugin-kit: `src/host/frames.ts` (new: `PLUGIN_FRAMES_SERVICE`, `createPluginFrames`); `plugin-api.ts` uses it for `frames`.
- Node descriptor: `framePlugins` from `ctx.workbenchPlugins` frame entries, dev-only omitted in static.

Deviations:

- Plugin traffic reuses the `HOST_CHANNEL_MESSAGE` sandbox discriminator with a `plugin` body (never a channel name), so `runtime-frame.ts` (not owned) routes it to `channels.ts` and its source/origin/document guards apply unchanged. No new message constant was needed in `histoire-app/src/app/util/const.ts`.
- Actor lifecycle and failure diagnostics are reserved `histoire:*` message types inside `plugin.message`, not extra bridge events.
- SDK adds `plugins.actors()` and `plugins.subscribe()` (needed to obtain an actor id); `frames()` returns the descriptor inventory. `session.plugins` is optional because `embed/view-session.ts` (not owned) builds sessions without it.
- `frame-actors.ts` (slice 10) got a one-line change so load failures are attributed to the triggering actor.
- plugin-kit receives the frame service through the root context (`Symbol.for` key) because `ExtensionHostServices`/`install.ts` are outside ownership; the app mirrors the interface (`FrameChannelService`).
- Wrapper-side admission of `plugin.post` is not rate-limited (no hook without editing `runtime-frame.ts`); SDK outgoing and frame incoming limiters still apply.
- Embed integration covers static only (dev runtime code is identical).

Tests added: protocol `plugin-channels.spec.ts`; SDK `plugin-channels.spec.ts`; plugin-kit `host-frames.spec.ts`; histoire `frame-plugin-channels.spec.ts`, `ui-frame-channels.spec.ts`, `embed/runtime-frame-plugins.spec.ts`, `embed/frame-plugin-descriptor.spec.ts`, `embed/integration/plugin-channels.spec.ts` (same-origin and cross-origin, two sessions on the same variant, data-only inventory without story frame or module evaluation). Fixtures extended: `utils/preview-runtime-app.ts` (`receive`), `utils/embed/runtime-frame.ts` (`framePlugins`, `plugin.message`). `frame-plugins-lifecycle.spec.ts` drops its stub-channel assertion.

Commands:

- `pnpm --filter @histoire/protocol test`: pass (94). `pnpm --filter @histoire/sdk test`: pass (148). `pnpm --filter @histoire/plugin-kit test`: pass (66, `tsc -p tsconfig.test.json` clean).
- `pnpm --filter histoire test`: 360 files pass; 7 failed under load (`node-sdk`, `mcp/test-cancellation`, `test-lifecycle`, `test-specs`, `test-targeting`, `variant-test-session/matching`, `workbench-vue`), all pass when rerun alone.
- `pnpm --filter @histoire/protocol|sdk|plugin-kit|@histoire/app build`, `pnpm --filter histoire build`: pass.
- Embed integration `host-channels`, `frame-plugins`, `plugin-channels`: pass (3 files, 6 tests).
- `tsc -p histoire-app/tsconfig.embed.json`: clean; `tsconfig.workbench.json`: only pre-existing `../App.vue` error. eslint on changed files: clean.

Open issues:

- Standalone wiring: canvases must call `useExtensionHost().frames.registerFrames(registry, window)` with their `createCanvasFrames` registry (`CanvasViewport.vue`, not owned; slice 08/13). Until then `api.frames.list()` is empty in the real standalone app; behavior is proven with a registry double.
- Inspector selected-frame contexts use `getHistoireTargetKey(target)` as `FrameRef.key`, not the canvas frame id; `api.frames.open(context.frame)` needs canvas keys (slice 05/06/13 to align) or a `PluginFrameRef` from `list()`.
- Explorer surface: `embed/adapters/explorer-session.ts` forwards only `channel` notifications; plugin messages through the iframe Explorer need one line there (`event.type === 'plugin'` to `plugin.message`).
- Native `@histoire/vue` hosts (slice 13) need a frame service backed by `session.plugins`.
- `histoire-plugin-kit/src/internal/not-implemented.ts` is now unused.
