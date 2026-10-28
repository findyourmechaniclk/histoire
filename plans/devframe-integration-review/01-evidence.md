# Slice 01 receipt — in progress

**Later integration update, 2026-10-28:** The initial status below is historical. Effective capabilities now intersect source and authenticated runtime actor availability, and origin policy is checked for live admission and completion. Live browser checks, packed consumer checks and the SDK suite are recorded in slices [03](03-evidence.md) and [09](09-evidence.md). After the final protocol changes, the full protocol suite passed 25 files / 114 tests; the workspace build and documentation build passed. Final overall conformance remains subject to the limits in those receipts.

Destination baseline `d6c8238c7eea443649f1ae9539b05bb16c69fa4f`; preserved candidate and hashes are recorded in [slice 00](00-evidence.md). Source worktree was not modified. This is a partial receipt, not a gate pass.

## Changes

- Protocol DTOs and validators cover bounded variant, DOM, highlight, diagnostic, component and accessibility data. Component ownership and audit types remain unadvertised; their provider is future work. Getter-free wire traversal rejects cyclic or unsupported DTOs. Operation-to-capability mapping is explicit.
- Descriptors and snapshots accept optional top-level inspection extensions, retaining strict legacy nested capability and policy maps. Source opt-in defaults off. Until runtime is integrated, even opt-in dev and static descriptors report all inspection operations unavailable.
- Finite bridge requests use explicit target plus captured existing identity, validate target against payload, constrain role, require runtime ownership, preserve selection generation, validate reply owner, and bound the complete inspection reply. No service is implemented by these contracts alone.
- The frozen v1 reader fixture was bundled from the current destination source before editing; it is not the candidate's older generated fixture.

## Evidence

- Node 24.16.0: protocol suite initially passed 23 files / 105 tests with child-process access. A subsequent run passed 105 tests but failed to import a concurrently added `debug-buffer.spec.ts` while its owner was writing its module; rerun after that slice settles.
- Protocol focused inspection tests passed; tests first demonstrated rejected exact-target transport and missing extension validation. `inspection-config.spec.ts` passed both config and real dev/static descriptor cases. Frozen/new readers accepted old/new descriptors and snapshots; strict nested keys and malformed extensions were rejected. Bounded unknown fields and accessor rejection tested.
- Fresh built protocol import test passed with child-process access, but source changed afterward; rebuild and rerun for final built-entry proof. No isolated fault-injection probe was run.

## Remaining gate work

Integrate actual effective embed-origin policy with live admission and revocation; validate all session, connection, mount, document and selection ownership through success, errors and cancellation. Run SDK baseline and browser graph check after coordinated builds. Real browser, packed-consumer and Devframe compatibility proofs belong to later gates. The full serialized result boundary and the component/a11y contracts require integration and browser evidence before advertisement.
