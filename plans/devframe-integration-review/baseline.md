# Baseline, scope and ownership

## Candidate inventory and status

| Area | Candidate source | Current main | Review decision to produce |
| --- | --- | --- | --- |
| Protocol and DTOs | `packages/histoire-protocol/src/inspection/`, `src/types/inspection*.ts`, bridge edits | strict bridge/types, wire limits and capability negotiation | preserve wire compatibility; classify each DTO and validator |
| Shared readers and isolated execution | `packages/histoire-shared/src/inspection/`; `histoire/src/node/runtime/inspection/`; MCP extraction | MCP isolated readers in `node/mcp/browser/inspection/`, browser execution, runtime lanes | prove extraction preserves behavior and authority; reuse, don't duplicate |
| Node API | `histoire/src/node/api/inspection*.ts`, `capture-source.ts` | `histoire/node` project API for capture/tests | trace source identity, lifetime, cancellation and errors |
| Browser live API | `histoire-sdk/src/session/inspection/`, `debug.ts`; embed adapters and runtime inspection handler | sessions, authenticated bridge, runtime ownership, selected variant/canvas | adapt to current ownership and mounting; remove grid assumptions |
| Optional adapter | `packages/histoire-devframe/src/{client,node,shared}` | no adapter package | types-only public entry vs internal code; re-prove real connection and hosting |
| Later product surfaces | old slice docs and tests | current workbench plugin kit, canvas/panels and a11y primitives | choose stable built-in/plugin seams; do not claim absent features |

The source worktree has both untracked new files and modifications; `git diff` alone cannot capture it. It also has changes to original plan files that already exist in `main`. Review all paths, including generated test fixtures, and decide which are reusable. Treat `.gitignore` content and symlinks carefully; ignored build outputs and credentials are not source by default.

## Invariants

1. Current `main` and each checkout's user changes are never silently replaced. Before editing a shared file, inspect both staged and unstaged diffs and recheck immediately before saving. Make any snapshot without clearing or modifying source.
2. Histoire owns source, session, runtime, mount and target authority. Devframe is optional and cannot turn connection identifiers, browser origin or caller JSON into identity. No default shared principal.
3. Live means exact already-mounted document and captures unsaved state. Isolated means separate fresh execution on the existing bounded queue. Never silently remount, retry against a successor or fall back between them. Preserve all applicable bridge session, connection, mount, source, runtime and target lifetimes; selection-bound work also captures selection generation.
4. Existing MCP tools, input schemas, result shapes, cancellation, admission, error envelopes, authorization and resource lifetimes remain compatible. Existing ARIA snapshot is not a compliance audit.
5. Capability advertisement is the intersection of config, runtime implementation, origin/policy, authenticated scope and installed optional dependencies. Defaults disabled. Cross-origin access uses existing Histoire authenticated bridge.
6. Inspection is finite, bounded, getter-safe and cancellation-aware. No arbitrary script execution, unrestricted shared-state mutation, unbounded traversal, credentials in URLs/logs, or background listening from an import.
7. No guessed framework ownership: Vue support uses actual ownership; React/Svelte component inspection returns unavailable until implemented.
8. Every async boundary rechecks authority, including after reads, listener callbacks, authorization, transport and cleanup. Dispose only resources acquired by the integration; caller-owned Histoire sessions, HTTP servers and Devframe connections remain alive.

## Current seams to revalidate

- `packages/histoire-protocol/src/bridge/`, `types/`, and SDK `src/session/`, `transport/` own wire/authority contracts. Validate old/new reader behavior rather than relying only on a generated fixture.
- `packages/histoire/src/node/mcp/browser/inspection/{task,state,dom,diagnostics,result}.ts` and `node/mcp/protocol/inspection-schema.ts` own current isolated behavior; `node/api/{capture,execution,project}.ts` own Node API lifecycle.
- `packages/histoire/src/node/virtual/preview-runtime/` and `packages/histoire-app/src/embed/adapters/` own runtime transport and current canvas mounting. Current `main` removed legacy grid sandbox; retain support for genuinely mounted multiple targets where current canvas implements them, not deleted grid-specific modules.
- `packages/histoire-plugin-kit/` and app `components/{extensions,inspector,canvas}/` own additive workbench integration. Verify public extension coverage and builtin needs before choosing a surface.
- Public package constraints: Node `>=22.12.0`, pnpm workspace catalogs and published exports. Verify supported dependency/API versions and lockfile against the exact candidate integration tree.

## File ownership and decision record

Each slice identifies likely paths, not authority to overwrite them. Before implementation, write a manifest of exact paths, their initial Git state and owner. Record for each candidate group: retain unchanged, adapt, replace by current equivalent, defer with reason, or discard. Explain observable behavior and tests for any replacement. Preserve repository rules and all concurrent modifications. Review security and lifecycle findings as release blockers when they affect promised behavior; unimplemented features are tracked separately from defects.
