import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<script setup>import Probe from './Probe.vue'</script>
<template><Story id="component-story" title="Component"><Variant id="one"><Probe label="first" /></Variant><Variant id="two"><Probe label="second" /></Variant></Story></template>`
const probe = `<script setup>defineProps({label:String})</script><template><button data-testid="probe">{{label}}</button></template>`

describe('vue component inspection through the mounted runtime', () => {
  it('highlights the selected component instance without changing selection or focus', async () => {
    const two = `<script setup>import { ref } from 'vue'; import Probe from './Probe.vue'; const expanded = ref(false); const shown = ref(true)</script><template><Story id="component-story" title="Component"><Variant id="one"><div><button data-testid="move" @click="expanded = !expanded">Move</button><button data-testid="remove" @click="shown = false">Remove</button><div :style="{ height: expanded ? '50px' : '0px' }"></div><Probe label="first" /><Transition name="probe"><Probe v-if="shown" label="second" /></Transition></div></Variant></Story></template><style>.probe-leave-active { transition: opacity 2s; } .probe-leave-to { opacity: 0; }</style>`
    const twoProbes = `<script setup>defineProps({label:String})</script><template><button :data-testid="label">{{label}}</button></template>`
    const fixture = await createEmbedBridgeFixture({ story: two, files: { 'Probe.vue': twoProbes }, inspection: 'host', inspectionComponents: true })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'component-story',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
      const frame = page.frames().find(value => value.url().includes('__sandbox.html'))!
      await frame.getByTestId('first').focus()
      const second = await page.evaluate('session.inspect.componentForElement({selector:"[data-testid=second]"})')
      await page.evaluate(id => (window as any).session.inspect.highlight({ componentId: id, durationMs: 5000 }), second.node.id)
      const actual = await frame.locator('[data-histoire-inspection-highlight]').boundingBox()
      const expected = await frame.getByTestId('second').boundingBox()
      expect(actual).toEqual(expected)
      expect(await frame.getByTestId('first').evaluate(element => element === document.activeElement)).toBe(true)
      expect(await page.evaluate('session.getSnapshot().selection')).toEqual({ storyId: 'component-story', variantId: 'one' })
      await frame.getByTestId('move').click()
      await expect.poll(async () => {
        const overlay = await frame.locator('[data-histoire-inspection-highlight]').boundingBox()
        const target = await frame.getByTestId('second').boundingBox()
        return overlay && target && overlay.y === target.y
      }).toBe(true)
      await frame.getByTestId('remove').click()
      await expect.poll(() => frame.locator('[data-histoire-inspection-highlight]').count()).toBe(0)
      expect(await frame.getByTestId('second').count()).toBe(1)
      await page.evaluate('session.dispose()')
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
  for (const enabled of [false, true]) {
    it(enabled ? 'owns each provider by its exact render and retires old instance IDs' : 'keeps component inspection disabled without explicit opt-in', async () => {
      const fixture = await createEmbedBridgeFixture({ story, files: { 'Probe.vue': probe }, inspection: 'host', inspectionComponents: enabled })
      const page = await fixture.browser.newPage()
      try {
        await page.goto(`${fixture.hostOrigin}/host.html`)
        await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'component-story',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
        if (!enabled) {
          expect(await page.evaluate('session.inspect.componentForElement({selector:"[data-testid=probe]"}).then(()=>null,error=>error.code)')).toBe('CAPABILITY_UNAVAILABLE')
          return
        }
        const first = await page.evaluate('session.inspect.componentForElement({selector:"[data-testid=probe]"})')
        expect(first).toMatchObject({ mode: 'live', matched: true, owner: { target: { storyId: 'component-story', variantId: 'one' } }, node: { name: 'Probe', framework: 'vue' } })
        const detail = await page.evaluate(id => (window as any).session.inspect.component({ componentId: id }), first.node.id)
        expect(detail.props).toEqual({ label: 'first' })
        await page.evaluate('session.selection.select({storyId:"component-story",variantId:"two"})')
        const second = await page.evaluate('session.inspect.componentForElement({selector:"[data-testid=probe]"})')
        expect(second.node.id).not.toBe(first.node.id)
        expect(await page.evaluate(id => (window as any).session.inspect.component({ componentId: id }).then(() => null, error => error.code), first.node.id)).toBe('RUNTIME_CHANGED')
        expect((await page.evaluate(id => (window as any).session.inspect.component({ componentId: id }), second.node.id)).props).toEqual({ label: 'second' })
      }
      finally {
        await page.close()
        await fixture.close()
      }
    }, 120_000)
  }
  it('retires same-target component identities when its source changes', async () => {
    const fixture = await createEmbedBridgeFixture({ story, files: { 'Probe.vue': probe }, inspection: 'host', inspectionComponents: true, mode: 'dev' })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'component-story',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
      const first = await page.evaluate('session.inspect.componentForElement({selector:"[data-testid=probe]"})')
      const revision = await page.evaluate('session.getSnapshot().source.revision')
      await appendFile(join(fixture.root, 'Book.story.vue'), '\n<!-- source revision -->\n')
      await expect.poll(() => page.evaluate('session.getSnapshot().source.revision'), { timeout: 30_000 }).not.toBe(revision)
      await expect.poll(() => page.evaluate('session.getSnapshot().inspection?.componentDetails?.available'), { timeout: 30_000 }).toBe(true)
      const next = await page.evaluate('session.inspect.componentForElement({selector:"[data-testid=probe]"})')
      expect(next.node.id).not.toBe(first.node.id)
      expect(await page.evaluate(id => (window as any).session.inspect.component({ componentId: id }).then(() => null, error => error.code), first.node.id)).toBe('RUNTIME_CHANGED')
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
})
