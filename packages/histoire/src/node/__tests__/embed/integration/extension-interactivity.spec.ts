import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'
import { buildEmbedVueHostModule } from '../../utils/embed/vue-host.js'

/** Real iframe below plugin content makes pointer pass-through observable. */
const story = `<script setup>import { ref } from 'vue'; const count = ref(0)</script><template><Story id="clicks"><Variant id="one"><button @click="count++">Frame {{ count }}</button></Variant></Story></template>`

/** Same Vue/runtime graph as native consumers; both supported view adapters stay real. */
const hostModule = `
import { createApp, defineComponent, h, ref, watch } from 'vue'
import { createHistoireSession } from '@histoire/sdk'
import { createExtensionHost, createSessionContext, defineWorkbenchPlugin } from '@histoire/plugin-kit'
import { HistoireProvider, HistoirePreview } from '@histoire/vue'
import { HistoireExtensionView } from '@histoire/vue/internal'
import '@histoire/vue/style.css'
export async function start(url, adapter) {
  const session = createHistoireSession({ url })
  await session.connect()
  await session.selection.select({ storyId: 'clicks', variantId: 'one' })
  const context = createSessionContext({ session })
  const interactive = ref(false)
  const clicks = ref(0)
  let mounts = 0
  const button = () => h('button', {
    'data-plugin-button': '',
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: interactive.value ? undefined : 'auto' },
    onClick: () => clicks.value++,
  }, 'Plugin button')
  const view = adapter === 'component'
    ? { component: defineComponent({ setup() { mounts++; return button } }) }
    : { mount(container) {
        mounts++
        const element = document.createElement('button')
        element.textContent = 'Plugin button'
        element.dataset.pluginButton = ''
        element.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:auto'
        element.onclick = () => clicks.value++
        // Passive content deliberately tries to opt in; interactive content inherits layer policy.
        const stop = watch(interactive, value => { element.style.pointerEvents = value ? '' : 'auto' }, { immediate: true })
        container.append(element)
        return { dispose() { stop(); element.remove() } }
      } }
  const host = createExtensionHost({ services: { context: context.context }, plugins: [
    defineWorkbenchPlugin({ id: 'pointer', apiVersion: 1, setup(api) {
      api.canvas.addOverlay({ id: 'overlay', space: 'viewport', ...view })
    } }),
  ] })
  await host.ready
  const contribution = host.available('canvas.overlay', context.context)[0]
  const app = createApp({ render: () => h(HistoireProvider, { session, extensions: host }, {
    default: () => h('div', { style: { position: 'relative', width: '360px', height: '200px', pointerEvents: 'none' } }, [
      h(HistoirePreview, { style: { width: '360px', height: '200px', pointerEvents: 'auto' } }),
      h(HistoireExtensionView, { contribution, context: context.context, interactive: interactive.value,
        style: { position: 'absolute', inset: 0 } }),
    ]),
  }) })
  app.mount('#mount')
  return { interactive, clicks, mounts: () => mounts, async close() {
    app.unmount(); await host.dispose(); context.close(); await session.dispose()
  } }
}
`

describe('native extension pointer ownership', () => {
  it.each(['component', 'mount'])('passes passive clicks to iframe and restores interactive %s without remounting', async (adapter) => {
    const bundle = await buildEmbedVueHostModule(hostModule)
    const fixture = await createEmbedBridgeFixture({
      story,
      hostHtml: '<!doctype html><link rel="stylesheet" href="/native.css"><div id="mount"></div>',
      hostModules: {
        '/native.js': { body: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text },
        '/native.css': { body: bundle.outputFiles.find(file => file.path.endsWith('.css'))!.text, contentType: 'text/css' },
      },
    })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`import('/native.js').then(async module => { window.probe = await module.start(${JSON.stringify(fixture.bookUrl)}, ${JSON.stringify(adapter)}) })`)
      await expect.poll(() => page.frames().some(frame => frame.url().includes('__sandbox.html'))).toBe(true)
      const runtime = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
      // Visible story DOM can precede runtime admission; the native surface is inert until then.
      await expect.poll(() => page.locator('.histoire-primary-frame').getAttribute('aria-busy')).toBe('false')
      const frameButton = runtime.getByRole('button', { name: 'Frame 0', exact: true })
      await expect.poll(() => frameButton.isVisible()).toBe(true)
      await expect.poll(() => page.locator('[data-plugin-button]').count()).toBe(1)
      const box = await frameButton.boundingBox()
      if (!box) throw new Error('Frame button has no box')
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await expect.poll(() => runtime.getByRole('button', { name: 'Frame 1', exact: true }).count()).toBe(1)
      expect(await page.evaluate('probe.clicks.value')).toBe(0)
      await page.locator('[data-plugin-button]').evaluate((button: HTMLElement) => button.focus())
      expect(await page.locator('[data-plugin-button]').evaluate(button => button === document.activeElement)).toBe(false)
      await page.evaluate('probe.interactive.value = true')
      await page.getByRole('button', { name: 'Plugin button', exact: true }).click()
      expect(await page.evaluate('probe.clicks.value')).toBe(1)
      expect(await page.locator('[data-plugin-button]').evaluate(button => button === document.activeElement)).toBe(true)
      expect(await page.evaluate('probe.mounts()')).toBe(1)
      await page.evaluate('probe.close()')
    }
    finally {
      await page.close()
      await fixture.close()
    }
  })
})
