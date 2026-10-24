import { join } from 'node:path'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'
import { MCP_REPOSITORY_ROOT } from '../../utils/mcp/cli-project.js'

const story = `<template><Story id="frames"><Variant id="one"><button>one ok</button></Variant></Story></template>`

// Book frame module echoing pings; the book's client module adds a toolbar action and a workbench
// Vue inspector tab. Both modules report evaluation through a binding Playwright installs in
// every document. The tab injects the view binding its host provides: it only resolves when the
// plugin's `vue` is the explorer's own instance.
const frame = `window.__probe?.('frame')
export default { id: 'probe', apiVersion: 1, attach(frame) {
  frame.channel.on('ping', data => { void frame.channel.post('pong', { echo: data, actorId: frame.actorId }) })
} }
`
const client = `import { defineComponent, h, inject } from 'vue'
window.__probe?.('client')
const BookTab = defineComponent({
  props: { context: { type: Object, required: true } },
  setup(props) {
    const binding = inject(Symbol.for('histoire.plugin-kit.workbench-view'), null)
    return () => h('p', 'Book tab ' + props.context.frame.target.variantId + (binding ? ' shared' : ' isolated'))
  },
})
export default { id: 'probe', apiVersion: 1, setup(api) {
  api.toolbar.addItem({ id: 'book', group: 'plugins', type: 'action', label: 'Book action', icon: 'play', run() {} })
  api.inspector.addTab({ id: 'tab', label: 'Book tab', icon: 'plug', component: BookTab })
} }
`

/**
 * Host script: SDK session plus a host-imported workbench plugin with the same id, wired through
 * plugin-kit's session context and SDK-backed frame service. Nothing from the book is imported.
 */
function connect(bookUrl: string) {
  return `(async()=>{
  const {createHistoireSession}=await import('/sdk.js')
  const kit=await import('/plugin-kit.js')
  window.session=createHistoireSession({url:${JSON.stringify(bookUrl)}})
  await session.connect()
  window.root=kit.createSessionContext({session,frames:kit.createSessionFrameService(session.plugins)})
  window.host=kit.createExtensionHost({plugins:[kit.defineWorkbenchPlugin({id:'probe',apiVersion:1,setup(api){window.api=api}})],services:{context:root.context}})
  await host.ready
  return {inventory:session.plugins.frames(),frames:api.frames.list(),capable:api.context.capabilities.has('frames')}
})()`
}

/** Mounts one surface, waits for the plugin actor and round-trips one ping through `api.frames`. */
function roundTrip(surface: string) {
  return `(async()=>{
  await session.selection.select({storyId:'frames',variantId:'one'})
  window.mounted=session.mount(document.getElementById('mount'),{surface:${JSON.stringify(surface)}})
  await mounted.ready
  await new Promise(resolve=>{const check=()=>api.frames.list().length?resolve():setTimeout(check,20);check()})
  const [ref]=api.frames.list()
  const channel=api.frames.open(ref)
  const pongs=[]
  channel.on('pong',data=>pongs.push(data))
  await channel.post('ping',${JSON.stringify(surface)})
  await new Promise(resolve=>{const check=()=>pongs.length?resolve():setTimeout(check,20);check()})
  return {pongs,actorId:ref.actorId}
})()`
}

describe('native host workbench plugins', () => {
  it.each(['static', 'dev'] as const)('talks to a cross-origin book frame plugin through the SDK and never evaluates book UI (%s)', async (mode) => {
    const kit = await build({ entryPoints: [join(MCP_REPOSITORY_ROOT, 'packages/histoire-plugin-kit/dist/index.js')], bundle: true, format: 'esm', platform: 'browser', write: false })
    const fixture = await createEmbedBridgeFixture({
      mode,
      story,
      files: { 'plugins/frame.js': frame, 'plugins/client.js': client },
      plugins: `{name:'probe',workbench:{id:'probe',apiVersion:1,frame:'./plugins/frame.js',client:'./plugins/client.js'}}`,
      hostModules: { '/plugin-kit.js': { body: kit.outputFiles[0].text } },
    })
    const page = await fixture.browser.newPage()
    const evaluations: Array<{ kind: string, url: string }> = []
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.exposeBinding('__probe', ({ frame }, kind: string) => {
        evaluations.push({ kind, url: frame.url() })
      })
      await page.goto(`${fixture.hostOrigin}/host.html`)
      // Data-only connection: the descriptor lists the frame plugin; nothing is evaluated.
      expect(await page.evaluate(connect(fixture.bookUrl))).toEqual({ inventory: [{ id: 'probe', apiVersion: 1 }], frames: [], capable: true })
      expect(page.frames().some(frame => frame.url().includes('__sandbox.html'))).toBe(false)
      expect(evaluations).toEqual([])

      const preview = await page.evaluate(roundTrip('preview')) as { pongs: unknown[], actorId: string }
      expect(preview.pongs).toEqual([{ echo: 'preview', actorId: preview.actorId }])
      // Only the book's frame module ran, inside the book's own story document.
      expect(evaluations.map(entry => entry.kind)).toEqual(['frame'])
      expect(evaluations[0].url.startsWith(fixture.bookOrigin)).toBe(true)

      // The source-origin explorer loads the book's own manifest; frame traffic still reaches
      // the host-imported plugin through the explorer's outer session.
      await page.evaluate('mounted.unmount()')
      evaluations.length = 0
      const explorer = await page.evaluate(roundTrip('explorer')) as { pongs: unknown[], actorId: string }
      expect(explorer.pongs).toEqual([{ echo: 'explorer', actorId: explorer.actorId }])
      const explorerFrame = page.frames().find(frame => frame.url().startsWith(fixture.bookOrigin) && frame.url().includes('surface=explorer'))!
      await expect.poll(() => explorerFrame.getByRole('button', { name: 'Book action' }).count()).toBe(1)
      expect(await page.getByRole('button', { name: 'Book action' }).count()).toBe(0)
      // The Vue component tab renders through the explorer's Vue, bound to the selected variant.
      await explorerFrame.getByRole('tab', { name: 'Book tab' }).click()
      await expect.poll(() => explorerFrame.getByText(/^Book tab one/).textContent()).toBe('Book tab one shared')
      // The book's client module ran once, in the book's own explorer document only.
      expect(evaluations.filter(entry => entry.kind === 'client').map(entry => entry.url.startsWith(fixture.bookOrigin) && entry.url.includes('surface=explorer'))).toEqual([true])

      await page.evaluate('Promise.all([mounted.unmount(),host.dispose()]).then(()=>session.dispose())')
      expect(errors).toEqual([])
    }
    finally {
      await page.close()
      await fixture.close()
    }
  })
})
