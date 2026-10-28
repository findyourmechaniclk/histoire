# 00 — Preserve, inventory and review candidate

## Outcome

Establish exactly what exists, whether it is safe to carry forward, and how each unit maps to current `main`. Produce a recoverable source snapshot, review findings and a path-level transplant map before changing implementation.

## Inputs and likely artifacts

- Source worktree `/home/akryum/.codex/worktrees/devframe-inspection/histoire`; current integration checkout at `main`; original plan pack; `packages/histoire-devframe/COMPATIBILITY.md` in source.
- Create a **new** snapshot and review directory in an authorized workspace location. Do not edit source or existing plan documents. Store a manifest and a lossless archive of candidate tracked modifications, staged state if any, and all relevant untracked files, including permissions/symlink targets. Do not copy credentials, ignored dependencies or build output by default; inventory any excluded potentially necessary artifact and ask for user choice if needed.
- Record source and destination `git status --porcelain=v2 -z --untracked-files=all`, HEAD, branch, index/worktree diffs and hashes. For source untracked files use NUL-safe paths and hash contents. Separately preserve the source HEAD and its reachable commit history, including both candidate-only commits, in a self-contained Git bundle in the authorized snapshot directory; a worktree diff or commit hashes alone are not a history backup. Verify the bundle can be fetched into an empty scratch repository and that both commit IDs and their ancestry are present; verify the file archive restores with matching hashes and record both locations and checksums. If bundle creation or verification is blocked, keep the source worktree untouched and report the preservation gate as blocked. Never run `git add`, stash, reset, clean, or overwrite source to obtain a snapshot. Read-only `.git` restrictions may make Git worktree creation unavailable: use a safe ordinary working directory only if an authorized integration checkout is provided; do not bypass permissions.

## Review steps

1. Recheck that no agent is editing source or destination; if contents change during snapshot, retry affected inventory and document it. Avoid assuming old status counts remain true.
2. List every source modification/untracked path, including original plan variants and `packages/histoire-devframe/COMPATIBILITY.md`. Compare candidate content both to its base and current main. For each, choose retain, adapt, already integrated, obsolete, defer or discard. For deleted/renamed main paths, trace the behavior to its current owner; old filename absence alone does not mean obsolete feature.
3. Trace end-to-end flows: isolated MCP task to output, public Node API and queue; live SDK call through bridge to runtime; diagnostics subscription; adapter entry, pairing, authorization, broker, remote call and cleanup. Enumerate which flows are only types, private helpers, test probes or actually reachable. Identify any ambiguous advertised capability.
4. Review security and lifecycle: trust inputs, principal derivation, grant replay/expiration, source/origin policy, credential exposure, stale async writes, identity collisions, cancellation and resource ownership. Review workbench, plugin and Tailwind changes for architectural drift. Identify tests that exercise public behavior vs source strings or fabricated mocks.
5. Refresh the dependency compatibility matrix from locally installed package source, metadata, lockfile and public APIs. If unavailable, obtain exact upstream evidence using approved means. Do not assume historical 1.2.2 claims hold, install new dependencies silently into source, or upgrade solely for recency. Decide exact supported pins/ranges and Node support as an explicit proposal.
6. Prioritize defects by impact and create a small ordered repair map tied to slices 01–09. Record targeted test reproduction and whether behavior is unproven. Maintain explicit shared-file ownership and no conflicting simultaneous edits.

## Deliverables and gate

- Snapshot manifest, file archive and self-contained commit-history bundle, with independent restore/integrity verification; classification of every candidate path and both local commits; baseline diff and architecture map; independent review findings with evidence and disposition.
- Commands and outcomes for representative baseline checks against current `main` and, where dependencies already exist, historical candidate; failed baseline builds are evidence, not permission to install or mutate candidate.
- Do not begin transplant until source preservation and mapping are complete. Unavailable upstream API, missing test environment or contradictory contracts must be recorded with a concrete blocker and unaffected work identified.
