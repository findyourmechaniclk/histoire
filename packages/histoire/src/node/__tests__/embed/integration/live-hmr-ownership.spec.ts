import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<template><Story id="hmr-audit" title="Audit"><Variant id="one"><section data-testid="audit"><img src="data:image/png;base64,iVBORw0KGgo=" /></section></Variant></Story></template>`

describe('live audit ownership during source replacement', () => {
  it('rejects an old request held during real HMR and permits a fresh audit', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host', inspectionAccessibility: true, mode: 'dev' })
    const page = await fixture.browser.newPage()
    const release = Promise.withResolvers<void>()
    let held = false
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'hmr-audit',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
      const original = await page.evaluate('({revision:session.getSnapshot().source.revision,runtime:session.getSnapshot().runtime.runtimeId})')
      const pattern = '**/browser/accessibility/index.js*'
      await page.route(pattern, async (route) => {
        if (!held) {
          held = true
          await release.promise
        }
        await route.continue().catch(() => {})
      })
      await page.evaluate('(()=>{window.pending=session.inspect.accessibility().then(()=>"fulfilled",error=>error.code)})()')
      await expect.poll(() => held, { timeout: 15_000 }).toBe(true)
      await appendFile(join(fixture.root, 'Book.story.vue'), '\n<!-- real HMR ownership revision -->\n')
      await expect.poll(() => page.evaluate('session.getSnapshot().source.revision'), { timeout: 30_000 }).not.toBe(original.revision)
      await expect.poll(() => page.evaluate('session.getSnapshot().runtime.runtimeId'), { timeout: 30_000 }).not.toBe(original.runtime)
      await expect.poll(() => page.evaluate('session.getSnapshot().inspection?.accessibilityAudit?.available'), { timeout: 30_000 }).toBe(true)
      expect(await page.evaluate('pending')).toBe('STALE_REVISION')
      release.resolve()
      await page.unroute(pattern)
      const fresh = await page.evaluate('session.inspect.accessibility({selector:"[data-testid=audit]"})')
      expect(fresh).toMatchObject({ mode: 'live', inspection: 'accessibility', matched: true, owner: { target: { storyId: 'hmr-audit', variantId: 'one' } } })
      expect(fresh.owner.revision).not.toBe(original.revision)
      await page.evaluate('session.dispose()')
    }
    finally {
      release.resolve()
      await page.close()
      await fixture.close()
    }
  }, 120_000)
})
