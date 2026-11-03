import type { PublicState } from '../protocol.js'
import { applyStatus, leaveStartup } from './transitions.js'

/** Connect top-level workbench/loading documents to proxy-owned process lifecycle. */
function connect() {
  if (window.top !== window || !('EventSource' in window)) return
  const script = document.querySelector<HTMLScriptElement>('script[data-histoire-generation]')
  const loading = document.body.hasAttribute('data-histoire-loading')
  const generation = script?.dataset.histoireGeneration ?? document.body.dataset.generation
  const originalBase = script?.dataset.histoireBase ?? document.body.dataset.base ?? '/'
  const events = new EventSource('/__histoire/dev/events')
  let navigating = false
  let disposeTimer: ReturnType<typeof setTimeout> | undefined
  /** Preserve selected route and URL state across an updated application base. */
  async function navigate(base: string) {
    if (navigating) return
    navigating = true
    events.close()
    if (loading) await leaveStartup()
    const url = new URL(location.href)
    if (url.pathname === '/') url.pathname = base
    else if (originalBase !== base && !url.pathname.startsWith(base) && url.pathname.startsWith(originalBase)) url.pathname = base + url.pathname.slice(originalBase.length)
    // Same-URL replace with a fragment can stay in current document. Explicit
    // reload is required to exchange loader HTML for ready workbench HTML.
    if (url.href === location.href) location.reload()
    else location.replace(url.href)
  }
  events.onmessage = ({ data }) => {
    let state: PublicState
    try {
      state = JSON.parse(data)
    }
    catch {
      return
    }
    clearTimeout(disposeTimer)
    if (loading) {
      if (state.status === 'ready') void navigate(state.base)
      else applyStatus(state)
    }
    // Shutdown leaves workbench in place; reloading would only reach a closed listener.
    else if (state.status !== 'closed' && (state.status !== 'ready' || state.generation !== generation)) {
      void navigate(state.base)
    }
  }
  const restart = document.getElementById('restart') as HTMLButtonElement | null
  restart?.addEventListener('click', () => {
    restart.disabled = true
    // New status arrives over the event stream; re-enable once the request settles.
    void fetch('/__histoire/dev/restart', { method: 'POST' }).catch(() => {}).finally(() => {
      restart.disabled = false
    })
  })
  events.onerror = () => {
    if (loading) {
      disposeTimer = setTimeout(() => {
        document.getElementById('status')!.textContent = 'Connecting'
      }, 3000)
    }
  }
  window.addEventListener('pagehide', () => {
    events.close()
    clearTimeout(disposeTimer)
  }, { once: true })
}
connect()
export {}
