import type { PublicState } from '../protocol.js'
import { bookMark } from './mark.js'
import { startupStyles } from './styles.js'

/** Escapes server-provided detail before insertion into standalone document. */
function escape(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
}

/** Render immediate useful HTML without Vue, Vite transforms or project assets. */
export function renderLoadingPage(state: PublicState): string {
  const title = state.status === 'failed' ? 'Histoire failed to start' : state.status === 'restarting' ? 'Restarting Histoire' : 'Starting Histoire'
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Histoire</title><style>${startupStyles}</style></head><body data-histoire-loading data-generation="${escape(state.generation)}" data-base="${escape(state.base)}"><main><canvas aria-hidden="true"></canvas><div class="identity">${bookMark}<h1>Histoire</h1></div><p id="status" role="status" aria-live="polite">${title}</p><p id="detail">${escape(state.error ?? '')}</p></main><script type="module" src="/__histoire/dev/lifecycle.js"></script><script type="module" src="/__histoire/dev/particles.js"></script></body></html>`
}
