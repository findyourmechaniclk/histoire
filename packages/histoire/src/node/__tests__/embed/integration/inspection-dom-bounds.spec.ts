import { createHistoireProject } from 'histoire/node'
import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<script setup>
import { defineComponent, h, onMounted, ref } from 'vue'
const Heavy = defineComponent({ setup() {
  const root = ref()
  onMounted(() => {
    const fragment = document.createDocumentFragment()
    for (let index = 0; index < 6000; index++) fragment.append(document.createElement('script'))
    const tail = document.createElement('p')
    tail.textContent = 'unvisited'
    fragment.append(tail)
    root.value.append(fragment)
  })
  return () => h('section', { id: 'bounded-root', ref: root })
} })
</script><template><Story id="bounded"><Variant id="one"><Heavy /></Variant></Story></template>`

describe('dom inspection work bounds across public surfaces', () => {
  it('reports truncation for excluded siblings in live and isolated documents', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host', mode: 'dev' })
    const page = await fixture.browser.newPage()
    let project: Awaited<ReturnType<typeof createHistoireProject>> | undefined
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'bounded',variantId:'one'});await session.mount(document.querySelector('#mount'),{surface:'preview'}).ready})()`)
      const live = await page.evaluate(`session.inspect.dom({selector:'#bounded-root',maxNodes:500,maxDepth:5})`)
      expect(live).toMatchObject({ mode: 'live', matched: true, truncated: true, nodes: [{ tag: 'section' }] })
      project = await createHistoireProject({ root: fixture.root, configFile: 'custom.ts' })
      const dev = await project.startDev({ host: '127.0.0.1', port: 0 })
      await dev.ready
      const isolated = await project.inspect.dom({ source: 'dev', storyId: 'bounded', variantId: 'one', selector: '#bounded-root', maxNodes: 500, maxDepth: 5 })
      expect(isolated).toMatchObject({ mode: 'isolated', matched: true, truncated: true, nodes: [{ tag: 'section' }] })
    }
    finally {
      await project?.close()
      await page.close()
      await fixture.close()
    }
  }, 120_000)
})
