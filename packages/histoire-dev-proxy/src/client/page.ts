import type { PublicState } from '../protocol.js'
import { blueprintMark } from './mark.js'
import { statusTitle } from './status.js'
import { startupStyles } from './styles.js'

/** Render-time options for the startup document. */
export interface LoadingPageOptions {
  /** Page without live lifecycle updates or navigation; `scripts` replace the lifecycle client. */
  frozen?: boolean
  /** Browser assets loaded by a frozen page. */
  scripts?: string[]
  /** Extra markup appended to the body, such as the state switcher. */
  extra?: string
}

/** Escapes server-provided detail before insertion into standalone document. */
export function escape(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
}

/** Applies the workbench's stored color scheme before first paint; storage may be unavailable. */
const schemeScript = 'try{const s=localStorage.getItem("histoire-color-scheme");if(s==="dark"||s==="light")document.documentElement.dataset.scheme=s}catch{}'

/** Render immediate useful HTML without Vue, Vite transforms or project assets. */
export function renderLoadingPage(state: PublicState, options: LoadingPageOptions = {}): string {
  const scripts = (options.frozen ? options.scripts ?? [] : ['lifecycle.js'])
    .map(name => `<script type="module" src="/__histoire/dev/${name}"></script>`)
    .join('')
  const status = escape(state.status)
  // `#outcome` stays in the document for every state so failure can expand into view.
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Histoire</title><script>${schemeScript}</script><style>${startupStyles}</style></head><body data-histoire-loading data-status="${status}" data-generation="${escape(state.generation)}" data-base="${escape(state.base)}"><main class="startup">${blueprintMark}<h1>Histoire</h1><p id="status" role="status" aria-live="polite" data-tone="${status}">${statusTitle(state.status)}</p><div id="outcome"><div><p id="detail">${escape(state.error ?? '')}</p><button id="restart" type="button">Restart</button></div></div></main>${options.extra ?? ''}${scripts}</body></html>`
}
