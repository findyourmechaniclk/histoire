import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<script setup>function initial(){ return { clicks:0 } }</script>
<template><Story id="highlight-story" title="Highlight"><Variant id="one" :init-state="initial"><template #default="{state}"><button data-testid="first" @click="state.clicks++">First {{state.clicks}}</button><button data-testid="second">Second</button></template></Variant></Story></template>`

describe('highlight ownership', () => {
  it('keeps a successor active after predecessor cleanup without intercepting interaction', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host' })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'highlight-story',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
      const frame = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
      await frame.getByTestId('first').focus()
      await page.evaluate('session.inspect.highlight({selector:"[data-testid=first]",durationMs:300})')
      await page.evaluate('session.inspect.highlight({selector:"[data-testid=second]",durationMs:2000})')
      const overlay = frame.locator('[data-histoire-inspection-highlight]')
      await expect.poll(() => overlay.count()).toBe(1)
      // Cross the predecessor's actual timeout before checking successor ownership.
      await frame.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)))
      expect(await overlay.count()).toBe(1)
      expect(await frame.getByTestId('first').evaluate(element => element === document.activeElement)).toBe(true)
      await frame.getByTestId('first').click()
      expect(await frame.getByTestId('first').textContent()).toBe('First 1')
      expect(await page.evaluate('session.getSnapshot().selection')).toEqual({ storyId: 'highlight-story', variantId: 'one' })
      await expect.poll(() => overlay.count(), { timeout: 5000 }).toBe(0)
      await page.evaluate('session.dispose()')
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
  it('clears only the captured highlight lease and picks inside the exact story frame', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host' })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'highlight-story',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
      const frame = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
      const point = await frame.getByTestId('first').evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      })
      const pick = await page.evaluate(point => (window as any).session.inspect.pick(point), point)
      expect(pick).toMatchObject({ matched: true, owner: { target: { storyId: 'highlight-story', variantId: 'one' } } })
      const element = await page.evaluate(selector => (window as any).session.inspect.dom({ selector }), pick.selector)
      expect(element.nodes[0]).toMatchObject({ tag: 'button', text: 'First 0' })
      expect(await page.evaluate('session.inspect.pick({x:-1,y:-1})')).toMatchObject({ matched: false })
      const outside = await frame.evaluate(() => {
        const button = document.createElement('button')
        button.textContent = 'Outside story'
        button.style.cssText = 'position:fixed;right:0;bottom:0'
        document.body.append(button)
        const bounds = button.getBoundingClientRect()
        return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      })
      expect(await page.evaluate(point => (window as any).session.inspect.pick(point), outside)).toMatchObject({ matched: false })
      const first = await page.evaluate('session.inspect.highlightLease({selector:"[data-testid=first]",durationMs:5000})')
      const second = await page.evaluate('session.inspect.highlightLease({selector:"[data-testid=second]",durationMs:5000})')
      const overlay = frame.locator('[data-histoire-inspection-highlight]')
      expect(await page.evaluate(lease => (window as any).session.inspect.clearHighlight({ target: lease.owner.target, expectedOwner: lease.owner, leaseId: lease.leaseId }), first)).toMatchObject({ cleared: false })
      expect(await overlay.count()).toBe(1)
      expect(await page.evaluate(lease => (window as any).session.inspect.clearHighlight({ target: lease.owner.target, expectedOwner: lease.owner, leaseId: lease.leaseId }), second)).toMatchObject({ cleared: true })
      expect(await overlay.count()).toBe(0)
      expect(await page.evaluate(lease => (window as any).session.inspect.clearHighlight({ target: lease.owner.target, expectedOwner: lease.owner, leaseId: lease.leaseId }), second)).toMatchObject({ cleared: false })
      await page.evaluate('session.dispose()')
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
  it('removes an installed highlight if origin permission is withdrawn before its reply', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host' })
    const page = await fixture.browser.newPage()
    const release = Promise.withResolvers<void>()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'highlight-story',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
      const frame = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
      let reads = 0
      await page.route('**/histoire-embed-origins.json', async (route) => {
        if (++reads === 2) {
          await release.promise
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 1, allowedOrigins: [] }) }).catch(() => {})
        }
        else {
          await route.fulfill({ status: 404, body: '' }).catch(() => {})
        }
      })
      await page.evaluate('(()=>{window.highlightResult=session.inspect.highlightLease({selector:"[data-testid=first]",durationMs:5000}).then(()=>"fulfilled",error=>error.code)})()')
      await expect.poll(() => reads, { timeout: 10_000 }).toBe(2)
      const overlay = frame.locator('[data-histoire-inspection-highlight]')
      expect(await overlay.count()).toBe(1)
      release.resolve()
      expect(await page.evaluate('highlightResult')).toBe('CAPABILITY_UNAVAILABLE')
      await expect.poll(() => overlay.count()).toBe(0)
      await page.unrouteAll()
      const fresh = await page.evaluate('session.inspect.highlightLease({selector:"[data-testid=second]"})')
      expect(await page.evaluate(lease => (window as any).session.inspect.clearHighlight({ target: lease.owner.target, expectedOwner: lease.owner, leaseId: lease.leaseId }), fresh)).toMatchObject({ cleared: true })
      await page.evaluate('session.dispose()')
    }
    finally {
      release.resolve()
      await page.close()
      await fixture.close()
    }
  }, 120_000)
})
