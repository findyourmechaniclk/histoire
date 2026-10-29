# @histoire/dev-proxy

Early HTTP hosting and process ownership for `histoire dev`. Public listener responds before project configuration or Vite imports. Standalone loading document uses Histoire particle artwork with static/reduced-motion fallbacks.

`startDevProxy({ runtime, root, port, host, runtimeOptions })` binds public listener and returns `{ url, status, ready, restart, close }`. `ready` observes initial acquisition; config errors reject it while persistent watcher permits later recovery. `close()` is idempotent. Public address defaults to `localhost:6006`; port `0` selects an ephemeral port.

Runtime executable receives typed private IPC from `@histoire/dev-proxy/protocol`. It starts once, reports evaluated configuration inputs and backend readiness, and handles graceful shutdown. Proxy owns file watching and serialized replacement. Ten-second winddown ends with forced owned-process-tree termination if necessary; successor never starts before exit is confirmed.

Package subpaths:

- `./lifecycle`: framework-neutral restart coordinator and abort-aware readiness.
- `./config`: config discovery, evaluation snapshots and byte-aware directory watches.
- `./protocol`: process messages and browser-safe lifecycle state.

Browser assets are built into `dist/browser` and served directly under `/__histoire/dev/`, independently of project Vite. No runtime dependency on other Histoire packages. SDK/MCP compatibility adapters can import lifecycle/config subpaths without loading HTTP or browser assets.

Validation covers real HTTP/process races, streamed requests, disconnect cancellation, forced descendant cleanup, browser handoff/HMR, and tarball installation outside workspace. Run `pnpm --filter @histoire/dev-proxy build` before package tests; CLI/browser integration suites consume built Histoire packages too.
