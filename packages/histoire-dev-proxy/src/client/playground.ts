import type { PublicState, RuntimeStatus } from '../protocol.js'
import { escape, renderLoadingPage } from './page.js'

/** Route serving the startup screen with a scripted state switcher for design iteration. */
export const designPlaygroundPath = '/__histoire/dev/loading'

/** States a viewer can jump to; `ready` plays the handoff fade. */
const steps = ['starting', 'restarting', 'failed', 'ready'] as const

/** Realistic one-line failure, matching what the proxy keeps from runtime errors. */
const sampleError = 'Cannot find module \'./plugins/theme\' imported from /home/me/project/histoire.config.ts'

/** Fixed top switcher; its styles stay inside this dev-only page. */
const switcherStyles = `<style>
.design-switcher {
  position: fixed; z-index: 10; left: 50%; top: 12px; transform: translateX(-50%);
  display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-width: calc(100vw - 32px);
  padding: 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface);
}
.design-switcher button {
  padding: 7px 10px; border: 0; border-radius: 6px; background: none; color: var(--muted);
  font: 12px/1 Inter, ui-sans-serif, system-ui, sans-serif; cursor: pointer;
}
.design-switcher button:hover { color: var(--text); }
.design-switcher button[aria-pressed] { background: var(--line); color: var(--text); }
.design-switcher hr { width: 1px; margin: 2px 4px; border: 0; background: var(--line); }
</style>`

/** Renders the startup screen in the requested state, driven client-side by `demo.js`. */
export function renderDesignPlayground(query: URLSearchParams, live: PublicState): string {
  const requested = query.get('status') as RuntimeStatus | null
  const status = requested && (steps as readonly string[]).includes(requested) && requested !== 'ready' ? requested : 'starting'
  const error = query.get('error') ?? sampleError
  const state: PublicState = { ...live, status, error: status === 'failed' ? error : undefined }
  const buttons = steps.map(step => `<button type="button" value="${step}"${step === status ? ' aria-pressed' : ''}>${step}</button>`).join('')
  const switcher = `${switcherStyles}<nav class="design-switcher" aria-label="Startup states" data-demo data-error="${escape(error)}">${buttons}<hr><button type="button" value="sequence">Play sequence</button></nav>`
  return renderLoadingPage(state, { frozen: true, scripts: ['demo.js'], extra: switcher })
}
