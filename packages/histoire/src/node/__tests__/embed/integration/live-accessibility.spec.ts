import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<template><Story id="audit-story" title="Audit"><Variant id="one"><section data-testid="audit-root"><img src="data:image/png;base64,iVBORw0KGgo=" /></section></Variant></Story></template>`

describe('live accessibility audit', () => {
  for (const enabled of [false, true]) {
    it(enabled ? 'audits only the captured mounted story with the local engine' : 'keeps audit unavailable without its separate opt-in', async () => {
      const fixture = await createEmbedBridgeFixture({ story, inspection: 'host', inspectionAccessibility: enabled })
      const page = await fixture.browser.newPage()
      try {
        await page.goto(`${fixture.hostOrigin}/host.html`)
        await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'audit-story',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
        if (!enabled) {
          expect(await page.evaluate('session.inspect.accessibility().then(()=>null,error=>error.code)')).toBe('CAPABILITY_UNAVAILABLE')
          return
        }
        const audit = await page.evaluate('session.inspect.accessibility({selector:"[data-testid=audit-root]"})')
        expect(audit).toMatchObject({ mode: 'live', inspection: 'accessibility', matched: true, engine: 'axe-core', owner: { target: { storyId: 'audit-story', variantId: 'one' } } })
        expect(audit.engineVersion).toEqual(expect.any(String))
        expect(audit.violations.map((item: { id: string }) => item.id)).toContain('image-alt')
        const missing = await page.evaluate('session.inspect.accessibility({selector:"#missing"})')
        expect(missing).toMatchObject({ matched: false, violations: [] })
        expect(await page.evaluate('session.inspect.accessibility({selector:"["}).then(()=>null,error=>error.code)')).toBe('INVALID_SELECTOR')
        expect(await page.evaluate('session.getSnapshot().selection')).toEqual({ storyId: 'audit-story', variantId: 'one' })
      }
      finally {
        await page.close()
        await fixture.close()
      }
    }, 120_000)
  }
})
