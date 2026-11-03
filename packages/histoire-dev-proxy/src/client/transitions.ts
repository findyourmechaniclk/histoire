import type { PublicState } from '../protocol.js'
import { statusTitle } from './status.js'

/** Latest requested swap; an older pending swap must not overwrite a newer state. */
let version = 0

/** Whether the viewer asked for no motion; transitions then apply instantly. */
function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Applies one public state to the startup page. CSS reacts to `body[data-status]` (logo, failure
 * outcome); the headline text slides out and back in so successive states read as a sequence.
 */
export function applyStatus(state: Pick<PublicState, 'status' | 'error'>) {
  const status = document.getElementById('status')!
  const title = statusTitle(state.status)
  // A cleared error keeps its old text while the outcome collapses; only a new error replaces it.
  if (state.error) document.getElementById('detail')!.textContent = state.error
  if (document.body.dataset.status === state.status && status.textContent === title) return
  document.body.dataset.status = state.status
  const current = ++version
  /** Swaps headline text and tone together so color and shimmer change with the words. */
  const swap = () => {
    status.textContent = title
    status.dataset.tone = state.status
  }
  if (reducedMotion()) {
    swap()
    return
  }
  status.getAnimations().forEach(animation => animation.cancel())
  const leave = status.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' })
  void leave.finished.then(() => {
    if (current !== version) return
    swap()
    leave.cancel()
    status.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' })
  }, () => {})
}

/** Fades the startup screen out, then resolves; callers navigate afterwards. */
export function leaveStartup(): Promise<void> {
  document.body.dataset.leaving = ''
  return new Promise(resolve => setTimeout(resolve, reducedMotion() ? 0 : 200))
}
