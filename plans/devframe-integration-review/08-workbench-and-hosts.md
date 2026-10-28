# 08 — Workbench, optional hosts and reports

Depends on 04, 06 and 07. Goal: integrate usable inspection surfaces into current workbench and optional host environments without reintroducing deleted UI architecture.

## Likely paths

`packages/histoire-plugin-kit/src/`, `packages/histoire-app/src/app/components/{extensions,inspector,canvas,shell}/`, `packages/histoire-vue/` only for genuinely native features, adapter client/Node package and existing docs. Inspect current additive panel, canvas tool/overlay and frame lease contracts before deciding builtin versus plugin implementation. Candidate worktree's old grid panels and style files are not authoritative.

## Steps

1. Map expected interactions: select actual mounted variant, pick element, inspect component/details and diagnostics, run a11y audit, navigate available source and clear highlight. Keep selections bound to owner tuple; runtime replacement resets unavailable data, and partial failures retain usable content.
2. Use existing workbench plugin contributions when their public lifecycle and authority meet the need. If a builtin surface is necessary, document why and reuse same SDK/service contracts. Follow current pane layout, `WorkbenchEmptyState`, `WorkbenchLoadingState`, `WorkbenchErrorState`, `WorkbenchPanelAction`, and `HstPulsatingDisc`. Use `htw:` Tailwind utilities; no decorative colored borders, custom spin animation or unnecessary UI copy. English visible copy never says “preview”. Keyboard and screen-reader paths match pointer behavior.
3. Define optional DevTools dock/middleware only if supported by the proven Devframe API. Configure explicitly and reuse authenticated broker; host disposal must not close unrelated listeners/connections. Missing host capability yields visible unavailable state rather than a dead button or silent fallback.
4. Define static report export as explicit opt-in, bounded and detached. Include historical timestamp, source and ownership identity, no live mutation or secrets; report remains usable offline without advertising a live session. Use existing export/download facilities where possible.
5. Feature-detect WebMCP and register only when explicitly enabled, supported, authenticated and scoped through the same service registry. If actual browser API or auth seam cannot meet these constraints, keep capability absent, document precise blocker and continue other work. Never register a dummy or alternate unprotected endpoint.

## Tests and gate

Behavior tests cover target switching, loading/error/recovery, keyboard actions, capability disabled, source navigation and cleanup; avoid presentation-class assertions. Browser exercise actual picking, inspection and audit with two live targets and replacement. Confirm extension disable/remount disposes its own observers, highlights and subscriptions, keeping other plugins and caller server alive. Test report offline and no secrets; verify WebMCP unavailable and available paths where a supporting browser exists. Record unavailable browser support as incomplete evidence, not success.
