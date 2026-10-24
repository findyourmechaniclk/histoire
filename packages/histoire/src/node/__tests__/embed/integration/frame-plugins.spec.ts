import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<script lang="ts">
import {onTest} from 'histoire/client'
import {it,expect} from 'vitest'
onTest(({canvas})=>{ it('renders',()=>expect(canvas.textContent).toContain('ok')) })
</script><template><Story id="frames"><Variant id="one"><button>one ok</button></Variant><Variant id="two"><button>two ok</button></Variant></Story></template>`

// Frame entry reporting module evaluation and its lifecycle through a binding
// Playwright installs in every frame of the page, whatever its origin.
const probe = `const report = event => window.__frameProbe?.(event)
report({ kind: 'evaluate' })
export default { id: 'probe', apiVersion: 1, attach(frame) {
  report({ kind: 'attach', actorId: frame.actorId, target: frame.target, options: frame.options, text: frame.element.textContent })
  frame.onCleanup(() => report({ kind: 'detach', actorId: frame.actorId }))
} }
`

/** Probe event, tagged with the URL of the frame document that sent it. */
interface ProbeEvent {
  /** Frame document URL. */
  url: string
  /** Lifecycle step. */
  kind: 'evaluate' | 'attach' | 'detach'
  /** Actor the step belongs to (attach and detach). */
  actorId?: string
  /** Rendered variant (attach). */
  target?: { storyId: string, variantId: string }
}

describe('frame plugins in story frames', () => {
  it.each(['static', 'dev'] as const)('attach to the interactive runtime only, survive test runs, and detach on selection change (%s)', async (mode) => {
    const fixture = await createEmbedBridgeFixture({
      mode,
      story,
      files: { 'plugins/probe.js': probe },
      plugins: `{name:'probe',workbench:{id:'probe',apiVersion:1,frame:'./plugins/probe.js',options:{tone:'warm'}}}`,
    })
    const page = await fixture.browser.newPage()
    const events: ProbeEvent[] = []
    const documents: string[] = []
    try {
      await page.exposeBinding('__frameProbe', ({ frame }, event) => {
        events.push({ url: frame.url(), ...event })
      })
      page.on('framenavigated', frame => documents.push(frame.url()))
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{ const {createHistoireSession}=await import('/sdk.js'); window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}}); await session.connect(); await session.selection.select({storyId:'frames',variantId:'one'}); window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'}); await primary.ready })()`)
      await expect.poll(() => events.filter(event => event.kind === 'attach').length).toBe(1)
      const [first] = events.filter(event => event.kind === 'attach')
      expect(first).toMatchObject({ target: { storyId: 'frames', variantId: 'one' }, options: { tone: 'warm' }, text: 'one ok' })

      // Test cases run in hidden worker documents; the interactive actor keeps its plugin.
      expect(await page.evaluate('session.tests.run({mode:"preview"})')).toMatchObject({ ok: true, passed: 1 })
      expect(documents.some(url => url.includes('purpose=test-worker'))).toBe(true)
      expect(events.filter(event => event.kind === 'evaluate').every(event => !event.url.includes('purpose='))).toBe(true)
      expect(events.filter(event => event.kind !== 'evaluate')).toEqual([first])

      await page.evaluate('session.selection.select({storyId:"frames",variantId:"two"})')
      await expect.poll(() => events.filter(event => event.kind === 'attach').length).toBe(2)
      const second = events.filter(event => event.kind === 'attach')[1]
      expect(second.target).toEqual({ storyId: 'frames', variantId: 'two' })
      expect(second.actorId).not.toBe(first.actorId)
      expect(events.filter(event => event.kind === 'detach')).toEqual([expect.objectContaining({ actorId: first.actorId })])
      await page.evaluate('primary.unmount(); session.dispose()')
    }
    finally {
      await page.close()
      await fixture.close()
    }
  })
})
