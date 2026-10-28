# Devframe integration: review and integration slices

Status: implementation in progress, 2026-10-28. Baseline: `main` at `d6c8238c7eea443649f1ae9539b05bb16c69fa4f`. The integration is implemented locally with focused, browser, transport and packed-consumer evidence in the slice receipts. Final conformance is incomplete: the DevTools dock and authenticated WebMCP remain unavailable, component source-location navigation is not implemented, and accessible names are not projected. No publication or CI result is claimed.

## Goal

Review and preserve the existing Devframe inspection implementation, adapt useful parts to current Histoire, and integrate a working optional adapter. Live inspection must read the actual mounted story and preserve unsaved state; existing isolated inspection must keep its current behavior. Ship no unverified public capability or partially wired endpoint.

The previous [Devframe plan pack](../devframe-inspection/README.md) remains the architectural reference for long-term scope. This pack supersedes its execution order and status assumptions for the recovered worktree; it does not assert that any original slice is complete. Resolve conflicts by tracing current contracts and recording a decision, not by copying older code wholesale.

## Starting evidence

- Source: `/home/akryum/.codex/worktrees/devframe-inspection/histoire`, detached at `a7ddbe5740aec6bb2a79c999285e55e56ea0bab2`; observed 43 modified and 82 untracked files, 136 commits behind current `main`. Counts and content can change concurrently. Two local commits concern old inspector/search code and are not an integration base.
- Candidate includes protocol inspection DTOs, shared readers, SDK session methods, runtime handlers, isolated Node API, debug code, Devframe grants/registry/dispatch and tests. Its `@histoire/devframe` client and Node public entry files currently export types only; internal broker files do not prove an available feature.
- Its `COMPATIBILITY.md` records historical slice-01 probes against Devframe and agentic 1.2.2 and MCP server/client 2.3.1. These results are useful leads, not evidence for current dependencies or this integration. Its README describes a smaller slice than the code now present.
- Current `main` already has four isolated MCP inspection operations, bounded results and execution lanes; browser SDK has a managed session/bridge but no public live inspection API; workbench plugin surfaces and Tailwind v4 work landed after the old base. Existing component picking and screenshot/test execution are reuse candidates.
- Three SWU/Nuxt worktrees have changes integrated into `main`; do not import their old state or undo their improvements. The present checkout also contains untracked `.claude/` material owned by other work.

## Read first

1. [Baseline, scope and ownership](baseline.md).
2. [Acceptance and evidence](acceptance.md).
3. Original [architecture](../devframe-inspection/architecture.md), [contracts](../devframe-inspection/contracts.md), [coordination](../devframe-inspection/coordination.md), and [validation](../devframe-inspection/validation.md).
4. Source worktree's `packages/histoire-devframe/COMPATIBILITY.md` as historical evidence only.

## Ordered slices

| Slice | Outcome | Gate |
| --- | --- | --- |
| [00](00-inventory-and-review.md) | Reproducible snapshot, independent behavior review and transplant map | All candidate files and local commits accounted for; review findings triaged |
| [01](01-contracts-and-boundaries.md) | Current compatible bounded protocol, capability and optional package boundaries | Old/new compatibility and inert imports proven |
| [02](02-isolated-inspection.md) | Shared bounded readers and public isolated Node API, with unchanged MCP | Existing MCP and owned execution parity proven |
| [03](03-live-inspection.md) | Exact mounted-session state/DOM/highlight through Histoire bridge and SDK | Real browser, exact ownership and cancellation proven |
| [04](04-diagnostics.md) | Optional bounded runtime/SDK diagnostics with correct cleanup | Loss, ownership and disposal proven |
| [05](05-devframe-pairing.md) | Browser attachment, authenticated grants and exact peer broker | Multi-principal, revocation and lifecycle proven |
| [06](06-agent-tools-and-hosting.md) | Explicit live MCP services, component events, discovery and owned hosting | Real transport, scoped event history, authorization, cancellation and old MCP parity proven |
| [07](07-components-and-accessibility.md) | Vue component ownership and live/isolated story-scoped accessibility audits | Real Vue/axe browser and Node evidence and honest capability reporting |
| [08](08-workbench-and-hosts.md) | Workbench integration, optional docks/reports and WebMCP decision | Current plugin/UI lifecycle and explicit opt-ins proven |
| [09](09-packaging-and-conformance.md) | Docs, examples, packed consumers and end-to-end conformance | Full milestone matrix and handoff complete |

Slices are sequential by default. Slice 02 can follow 01 while 03 starts only after 01 and shared contracts are stable; 04 follows 03; 05 follows 03; 06 follows 02, 04 and 05; 07 follows 02, 03 and 06; 08 follows 04, 06 and 07; 09 follows all. Shared modules require a single owner; do not run concurrent edits without explicit coordination.

**Milestone A:** slices 00–03 deliver optional bounded live and isolated reads with no Devframe server. **Milestone B:** slices 04–06 connect an explicitly paired Devframe session to finite live tools. **Milestone C:** slices 07–09 complete component/a11y and documented integrations. User requested full integration: later milestones are not silently dropped if earlier ones pass. If an upstream capability proves unavailable, keep it disabled, document the blocker and its exact effect, and continue independent work.

## Working rules

- Preserve all unowned staged, unstaged, untracked, generated and concurrent work. Do not reset, clean, overwrite, stage, commit, push, publish, or remove a worktree as part of this plan. Source worktree remains untouched.
- A reviewed snapshot is an input, not proof that its content is current. Transplant by logical change, never replace directories, `pnpm-lock.yaml`, or current architecture wholesale. Record every discard and rationale.
- Review before writing implementation; add behavior-level failing regression tests before each fix or feature when valuable. Do not test classes, styles, source substrings or mock-only behavior as proof of runtime behavior.
- Existing code may exceed 300 lines; new or changed modules should stay small where practical, document complex logic and public functions/properties, reuse existing fixtures and utilities.
- UI follows repository AGENTS.md: English, no visible “preview”, shared workbench state/action components, Tailwind v4 `htw:` utilities, no decorative colored borders or custom spinners.
- Completion requires a receipt per slice: exact source baseline and candidate snapshot, affected paths, decisions, tests and failures, evidence category, unresolved risks, and next slice readiness. Never infer successful browser, transport, packed-consumer or CI proof from unit tests.
