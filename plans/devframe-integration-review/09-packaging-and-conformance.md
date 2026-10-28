# 09 — Packaging, documentation and final conformance

Depends on all earlier slices. Goal: provide a reproducible, usable integration with honest feature and evidence boundaries.

## Likely paths

`packages/histoire-devframe/{package.json,README.md,COMPATIBILITY.md}`, package exports, `pnpm-lock.yaml`, `docs/`, minimal examples, existing package/consumer tests, original and new plan receipts. Do not rewrite current lockfile from candidate; update from resolved dependency graph and review diff.

## Steps

1. Verify package graph, Node engines, exports/declarations, optional peer metadata, browser/client vs Node dependency boundaries, version pin strategy and reproducible lockfile. Check Histoire release/build package discovery includes adapter. Build required dependencies in dependency order; avoid simultaneous builds writing the same `dist`.
2. Pack packages and install into an isolated consumer outside workspace with no aliases and no implicit monorepo resolution. Test Node import with no DOM; browser bundle with no Node/server dependencies; core SDK without Devframe; activated adapter with supported dependencies; graceful unavailable result when optional components absent. Exercise declared exports and Node16, NodeNext and Bundler type consumers where applicable.
3. Provide small SDK host and explicit Devframe pairing/agent examples using public APIs; show live versus isolated semantics, opt-in config, principal provisioning, origin/authorization, disposal, expected failures, version/host constraints, disabled defaults, privacy and limits. Describe actual features only. Use neutral English UI wording; avoid leaking credentials in examples. Document browser compatibility and WebMCP status based on real proof.
4. Complete the full [acceptance matrix](acceptance.md), audit all 00 review findings and candidate paths, and verify each implemented feature has a receipt tied to exact integration tree and matching test command. Delete no source worktree or archive as part of delivery. Distinguish deferred/unsupported features from proven implementation and identify blockers that prevent milestone completion.
5. Run focused, integration, browser, package, scoped lint/typecheck, broad builds/docs and styling guards appropriate to final changes. Rerun only affected checks if tree changes. Review final diffs and tests for unnecessary duplication, resource leaks and unintended work. Check `git diff --check` plus status and preservation of other work.

## Completion gate

Milestone C is complete only when full intended integration is present or user accepts an explicitly scoped change, all required evidence is recorded, no unresolved release-blocking review findings remain, and exact limitations are communicated. CI is only confirmed by actual CI. Plans do not authorize staging, commits, push, publishing, deployment, removal of worktrees or archival of user work.
