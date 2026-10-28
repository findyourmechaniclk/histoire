import type { Page, Route } from 'playwright'
import { createHistoireProject } from 'histoire/node'
import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<script setup>function initial(){ return { count: 3 } }</script>
<template><Story id="inspection" title="Inspection"><Variant id="one" :init-state="initial"><template #default="{state}"><button data-testid="counter" @click="state.count++">Count {{state.count}}</button></template></Variant><Variant id="two" :init-state="initial"><template #default="{state}"><button>Other {{state.count}}</button></template></Variant></Story></template>`

/** Hold the second external policy read, after the real runtime has replied. */
async function holdPolicyCompletion(page: Page) {
  const release = Promise.withResolvers<void>()
  let count = 0
  const pattern = '**/histoire-embed-origins.json'
  const handler = async (route: Route) => {
    if (++count === 2) await release.promise
    await route.fulfill({ status: 404, body: '' }).catch(() => {})
  }
  await page.route(pattern, handler)
  return {
    wait: () => expect.poll(() => count, { timeout: 10_000 }).toBeGreaterThanOrEqual(2),
    async close() {
      release.resolve()
      await page.unroute(pattern, handler)
    },
  }
}

describe('live inspection of a mounted runtime', () => {
  it('reads unsaved state and DOM without mounting another actor, across same and permitted origins', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host' })
    try {
      for (const origin of [fixture.bookOrigin, fixture.hostOrigin]) {
        const page = await fixture.browser.newPage()
        try {
          await page.goto(`${origin}/host.html`)
          await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'inspection',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
          const frame = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
          await frame.getByTestId('counter').click()
          const state = await page.evaluate('session.inspect.variant()')
          expect(state).toMatchObject({ mode: 'live', inspection: 'variant', state: { count: 4 }, owner: { target: { storyId: 'inspection', variantId: 'one' } } })
          const dom = await page.evaluate('session.inspect.dom({selector:"[data-testid=counter]"})')
          expect(dom).toMatchObject({ mode: 'live', inspection: 'dom', matched: true, nodes: [{ tag: 'button', text: 'Count 4' }] })
          expect(await page.evaluate('session.getSnapshot().selection')).toEqual({ storyId: 'inspection', variantId: 'one' })
          expect(page.frames().filter(item => item.url().includes('__sandbox.html'))).toHaveLength(1)
          await page.evaluate('primary.unmount()')
          expect(await page.evaluate('session.inspect.variant().then(()=>null,error=>error.code)')).toBe('PREVIEW_NOT_READY')
          await page.evaluate('session.dispose()')
        }
        finally { await page.close() }
      }
    }
    finally { await fixture.close() }
  }, 120_000)
  it('denies a cross-origin host allowed to embed but not inspect', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'same-origin' })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      const result = await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');const session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});try{await session.connect();await session.selection.select({storyId:'inspection',variantId:'one'});const primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready;return {available:session.getSnapshot().inspection?.variant?.available,code:await session.inspect.variant().then(()=>null,error=>error.code)}}finally{await session.dispose()}})()`)
      expect(result).toEqual({ available: false, code: 'CAPABILITY_UNAVAILABLE' })
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
  it('isolates two simultaneous targets and leaves isolated inspection fresh', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host' })
    const page = await fixture.browser.newPage()
    let project: Awaited<ReturnType<typeof createHistoireProject>> | undefined
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');const second=document.createElement('div');second.id='second';second.style.cssText='width:720px;height:560px';document.body.append(second);window.sessions=[createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}}),createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}})];for(let i=0;i<2;i++){const s=sessions[i];await s.connect();await s.selection.select({storyId:'inspection',variantId:i?'two':'one'});await s.mount(document.querySelector(i?'#second':'#mount'),{surface:'preview'}).ready}})()`)
      const first = page.frames().find(frame => frame.url().includes('__sandbox.html') && frame.url().includes('variantId=one'))!
      await first.getByTestId('counter').click()
      const values = await page.evaluate('Promise.all(sessions.map(s=>s.inspect.variant()))')
      expect(values.map(result => [result.owner.target.variantId, result.state.count])).toEqual([['one', 4], ['two', 3]])
      const held = await holdPolicyCompletion(page)
      try {
        await page.evaluate('(()=>{window.firstRead=sessions[0].inspect.variant({target:{storyId:"inspection",variantId:"one"}})})()')
        await held.wait()
        await page.evaluate('sessions[1].selection.select({storyId:"inspection",variantId:"one"})')
      }
      finally { await held.close() }
      expect(await page.evaluate('firstRead')).toMatchObject({ state: { count: 4 }, owner: { target: { storyId: 'inspection', variantId: 'one' } } })
      await page.evaluate('sessions[0].dispose()')
      expect(await page.evaluate('(async()=> (await sessions[1].inspect.variant()).state.count)()')).toBe(3)
      project = await createHistoireProject({ root: fixture.root, configFile: 'custom.ts' })
      const dev = await project.startDev({ host: '127.0.0.1', port: 0 })
      await dev.ready
      expect(await project.inspect.variant({ source: 'dev', storyId: 'inspection', variantId: 'one' })).toMatchObject({ mode: 'isolated', state: { count: 3 } })
      await page.evaluate('sessions[1].dispose()')
    }
    finally {
      await project?.close()
      await page.close()
      await fixture.close()
    }
  }, 120_000)
  it('rejects held results after cancellation, selection return, reconnect and session replacement', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host' })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.createSession=createHistoireSession;window.session=createSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'inspection',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
      for (const action of ['cancel', 'selection', 'reconnect', 'replace']) {
        const held = await holdPolicyCompletion(page)
        try {
          await page.evaluate('(()=>{window.controller=new AbortController();window.pending=session.inspect.variant({signal:controller.signal}).then(()=>"fulfilled",error=>error.code)})()')
          await held.wait()
          if (action === 'cancel') {
            await page.evaluate('controller.abort()')
          }
          else if (action === 'selection') {
            await page.evaluate('(async()=>{await session.selection.select({storyId:"inspection",variantId:"two"});await session.selection.select({storyId:"inspection",variantId:"one"})})()')
          }
          else if (action === 'reconnect') {
            await page.locator('iframe[title="Histoire source bridge"]').evaluate((frame: HTMLIFrameElement) => {
              frame.src = 'about:blank'
            })
            await expect.poll(() => page.evaluate('session.getSnapshot().status')).toBe('disconnected')
            await page.evaluate('(async()=>{window.sameSession=session;await session.connect();window.primary=session.mount(document.querySelector("#mount"),{surface:"preview"});await primary.ready})()')
            expect(await page.evaluate('sameSession===session')).toBe(true)
          }
          else {
            await page.evaluate(`(async()=>{await session.dispose();window.session=createSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'inspection',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
          }
          expect(await page.evaluate('pending')).toBe(action === 'cancel' ? 'CANCELLED' : action === 'replace' ? 'DISPOSED' : action === 'reconnect' ? 'NOT_CONNECTED' : 'RUNTIME_CHANGED')
        }
        finally { await held.close() }
        expect(await page.evaluate('(async()=> (await session.inspect.variant()).state.count)()')).toBe(3)
      }
      await page.evaluate('session.dispose()')
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
})
