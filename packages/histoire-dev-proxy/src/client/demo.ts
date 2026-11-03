import type { RuntimeStatus } from '../protocol.js'
import { applyStatus, leaveStartup } from './transitions.js'

/** One scripted step: a state, or the ready handoff, held for a duration. */
type Step = [RuntimeStatus | 'ready', number]

/** Representative lifecycle: a failed start, a manual restart failing again, then a successful one. */
const sequence: Step[] = [['starting', 2200], ['failed', 3000], ['restarting', 2200], ['failed', 3000], ['restarting', 2200], ['ready', 1200]]

/** Drives the frozen design page through lifecycle transitions without a real runtime. */
function demo() {
  const switcher = document.querySelector<HTMLElement>('[data-demo]')
  if (!switcher) return
  const error = switcher.dataset.error!
  let timer: ReturnType<typeof setTimeout> | undefined
  /** Shows one state with the same transitions as the live page. */
  async function show(step: RuntimeStatus | 'ready') {
    for (const button of switcher!.querySelectorAll<HTMLButtonElement>('button')) button.toggleAttribute('aria-pressed', button.value === step)
    if (step !== 'ready') {
      applyStatus({ status: step, error: step === 'failed' ? error : undefined })
      return
    }
    // Simulated handoff: fade out as before navigation, then come back as a fresh page load.
    await leaveStartup()
    delete document.body.dataset.leaving
    applyStatus({ status: 'starting' })
  }
  /** Plays the scripted sequence from `index`, looping until another control is used. */
  function play(index = 0) {
    const [step, duration] = sequence[index]
    void show(step)
    timer = setTimeout(() => play((index + 1) % sequence.length), duration)
  }
  switcher.addEventListener('click', (event) => {
    const button = (event.target as Element).closest('button')
    if (!button) return
    clearTimeout(timer)
    if (button.value === 'sequence') play()
    else void show(button.value as RuntimeStatus)
  })
  // Same affordance as the live failure screen, simulated.
  document.getElementById('restart')!.addEventListener('click', () => {
    clearTimeout(timer)
    void show('restarting')
  })
}
demo()
