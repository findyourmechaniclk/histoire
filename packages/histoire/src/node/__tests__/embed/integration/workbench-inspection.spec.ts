import { expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<script setup>import Probe from './Probe.vue';function initial(){return {count:3}}</script>
<template><Story id="inspection" title="Inspection story"><Variant id="one" title="One" :init-state="initial"><template #default="{state}"><button data-testid="counter" @click="state.count++">Count {{state.count}}</button><Probe label="first" /><img data-testid="audit-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="></template></Variant><Variant id="two" title="Two" :init-state="initial"><template #default="{state}"><button data-testid="other">Other {{state.count}}</button><Probe label="second" /></template></Variant></Story></template>`

it('inspects live selected state and DOM in the standalone workbench', async () => {
  const fixture = await createEmbedBridgeFixture({ story, files: { 'Probe.vue': `<script setup>defineProps({label:String})</script><template><button>{{label}}</button></template>` }, inspection: 'same-origin', inspectionComponents: true, inspectionAccessibility: true, embedding: false, config: `routerMode:'hash',` })
  const page = await fixture.browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(`${fixture.bookUrl}#story/inspection?variantId=one&tab=histoire-inspection:state`)
    const panel = page.getByRole('tabpanel')
    await expect.poll(async () => panel.count(), { timeout: 15_000 }).toBe(1)
    await expect.poll(async () => panel.textContent(), { timeout: 15_000 }).toContain('Read state')
    const frame = page.frameLocator('.histoire-canvas-frame.is-selected iframe[title="Histoire variant"]')
    await frame.locator('button[data-testid=counter]:visible').first().click()
    await page.getByRole('button', { name: 'Pick element' }).click()
    const counter = frame.locator('button[data-testid=counter]:visible').first()
    const bounds = await counter.boundingBox()
    expect(bounds).not.toBeNull()
    await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
    await expect.poll(() => page.getByLabel('CSS selector').inputValue()).not.toBe('')
    await expect.poll(async () => panel.textContent()).toContain('Count 4')
    await page.getByRole('button', { name: 'Highlight', exact: true }).click()
    await expect.poll(() => frame.locator('[data-histoire-inspection-highlight]').count()).toBe(1)
    await page.getByRole('button', { name: 'Clear highlight' }).click()
    await expect.poll(() => frame.locator('[data-histoire-inspection-highlight]').count()).toBe(0)
    await page.getByRole('button', { name: 'Read state' }).click()
    await expect.poll(async () => panel.textContent()).toContain('"count": 4')
    await page.getByLabel('CSS selector').fill('[data-testid=counter]')
    await page.getByRole('button', { name: 'Read DOM' }).click()
    await expect.poll(async () => panel.textContent()).toContain('Count 4')
    await page.getByRole('button', { name: 'Read components' }).click()
    await expect.poll(async () => page.getByRole('button', { name: 'Probe', exact: true }).count()).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Probe', exact: true }).first().click()
    await expect.poll(async () => panel.textContent()).toContain('"label": "first"')
    expect(await page.getByRole('region', { name: 'Component details' }).textContent()).not.toContain('runtimeId')
    await page.getByRole('button', { name: 'Run audit' }).click()
    await expect.poll(async () => panel.textContent(), { timeout: 30_000 }).toMatch(/images.*alternative/i)
    await page.evaluate(() => {
      location.hash = 'story/inspection?variantId=two&tab=histoire-inspection:state'
    })
    await expect.poll(async () => panel.textContent()).not.toContain('Count 4')
    const otherFrame = page.frameLocator('.histoire-canvas-frame.is-selected iframe[title="Histoire variant"]')
    await otherFrame.locator('button[data-testid=other]:visible').first().waitFor()
    await page.getByRole('button', { name: 'Read state' }).click()
    await expect.poll(async () => panel.textContent()).toContain('"count": 3')
    expect(await panel.textContent()).not.toContain('"count": 4')
    expect(await page.getByRole('button', { name: 'Run audit' }).count()).toBe(1)
    expect(errors).toEqual([])
  }
  catch (error) {
    const body = (await page.locator('body').textContent())?.slice(-3000)
    throw new Error(`Workbench inspection failed at ${page.url()}: ${String(error)}; page errors: ${errors.join(', ')}; body tail: ${body}`)
  }
  finally {
    await page.close()
    await fixture.close()
  }
}, 120_000)
