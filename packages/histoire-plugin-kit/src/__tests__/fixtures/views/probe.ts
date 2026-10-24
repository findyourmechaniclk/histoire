/**
 * Behavior shared by every adapter fixture view. Each view renders a button labelled
 * `<context.tag>:<clicks>` (local state, incremented on click) and, while mounted, keeps
 * a portal element in the overlay root (the framework's own portal where it has one) and a
 * window listener counting key presses. Adapter tests prove both are gone after disposal.
 */
import type { ViewHost } from '../../../index.js'

/** Key presses seen by mounted fixture views. */
export const probe = { keys: 0 }

/** Counts one key press. */
function onKey(): void {
  probe.keys++
}

/**
 * Attaches the fixture's window listener and, for frameworks without portals, its portal.
 * @param host View host of the mounted view.
 * @param withPortal Whether to append the portal element by hand.
 * @returns Detach function.
 */
export function attachProbe(host: ViewHost, withPortal = true): () => void {
  const portal = host.overlayRoot.ownerDocument.createElement('div')
  portal.textContent = 'portal'
  if (withPortal) host.overlayRoot.append(portal)
  window.addEventListener('keydown', onKey)
  return () => {
    portal.remove()
    window.removeEventListener('keydown', onKey)
  }
}
