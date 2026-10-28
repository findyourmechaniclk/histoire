import { writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = '<template><Story id="diagnostics" title="Diagnostics"><Variant id="one"><button>Ready</button></Variant></Story></template>'

describe('opt-in live diagnostics', () => {
  it('shares one observer, captures console and nonfatal errors, and stops after the final subscriber', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host', inspectionDiagnostics: true })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'diagnostics',variantId:'one'});await session.mount(document.querySelector('#mount'),{surface:'preview'}).ready})()`)
      const frame = page.frames().find(item => item.url().includes('__sandbox.html'))!
      await frame.evaluate('window.originalLog = console.log; window.originalDebug = console.debug')
      const beforeMs = await frame.evaluate('(()=>{const start=performance.now();for(let index=0;index<300;index++)console.debug("diagnostic overhead sample");return performance.now()-start})()')
      await page.evaluate('(async()=>{window.first=session.debug.subscribe(()=>{});window.second=session.debug.subscribe(()=>{});await Promise.all([first.ready,second.ready])})()')
      expect(await frame.evaluate('console.log !== window.originalLog')).toBe(true)
      await frame.evaluate('console.log("hello token=secret https://user:pass@example.test/path?token=value")')
      await expect.poll(() => page.evaluate('session.debug.getSnapshot().items.map(item=>item.message)'), { timeout: 5000 }).toContain('hello token=[redacted] https://example.test/path')
      // This browser warning is intentionally ignored by the runtime error overlay.
      await frame.evaluate('window.dispatchEvent(new ErrorEvent("error",{message:"ResizeObserver loop limit exceeded"}))')
      await expect.poll(() => page.evaluate('session.debug.getSnapshot().items.map(item=>item.message)'), { timeout: 5000 }).toContain('ResizeObserver loop limit exceeded')
      await page.evaluate('first.unsubscribe()')
      expect(await frame.evaluate('console.log !== window.originalLog')).toBe(true)
      await frame.evaluate('console.log("still active")')
      await expect.poll(() => page.evaluate('session.debug.getSnapshot().items.map(item=>item.message)'), { timeout: 5000 }).toContain('still active')
      await page.evaluate('second.unsubscribe()')
      expect(await frame.evaluate('console.log === window.originalLog && console.debug === window.originalDebug')).toBe(true)
      const afterMs = await frame.evaluate('(()=>{const start=performance.now();for(let index=0;index<300;index++)console.debug("diagnostic overhead sample");return performance.now()-start})()')
      if (process.env.HISTOIRE_DIAGNOSTIC_RECEIPT) await writeFile(process.env.HISTOIRE_DIAGNOSTIC_RECEIPT, JSON.stringify({ calls: 300, beforeMs, afterMs }))
      if (!process.env.HISTOIRE_EMBED_BROWSER || process.env.HISTOIRE_EMBED_BROWSER === 'chromium') {
        await page.evaluate(`(async()=>{
          const consumer={receive() { return 1 }};
          window.releasedDiagnosticConsumer=new WeakRef(consumer);
          window.heldDiagnosticConsumer={};
          window.heldDiagnosticControl=new WeakRef(window.heldDiagnosticConsumer);
          const handle=session.debug.subscribe(consumer.receive.bind(consumer));
          await handle.ready;
          await handle.unsubscribe();
          window.retainedDiagnosticHandle=handle;
        })()`)
        const cdp = await page.context().newCDPSession(page)
        try {
          await expect.poll(async () => {
            await cdp.send('HeapProfiler.collectGarbage')
            return page.evaluate('window.releasedDiagnosticConsumer.deref() === undefined')
          }, { timeout: 5000 }).toBe(true)
          expect(await page.evaluate('window.heldDiagnosticControl.deref() !== undefined')).toBe(true)
        }
        finally { await cdp.detach() }
      }
      await frame.evaluate('console.log("after stop")')
      expect(await page.evaluate('session.debug.getSnapshot().items.map(item=>item.message)')).not.toContain('after stop')
      await page.evaluate('(async()=>{window.disposedSessionWeak=new WeakRef(window.session);await window.session.dispose();window.session=null})()')
      if (!process.env.HISTOIRE_EMBED_BROWSER || process.env.HISTOIRE_EMBED_BROWSER === 'chromium') {
        const cdp = await page.context().newCDPSession(page)
        try {
          await expect.poll(async () => {
            await cdp.send('HeapProfiler.collectGarbage')
            return page.evaluate('window.disposedSessionWeak.deref() === undefined')
          }, { timeout: 5000 }).toBe(true)
          expect(await page.evaluate('window.heldDiagnosticControl.deref() !== undefined')).toBe(true)
        }
        finally { await cdp.detach() }
      }
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
  it('clears retained evidence and closes its observation when a fatal error retires the runtime', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'host', inspectionDiagnostics: true })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'diagnostics',variantId:'one'});await session.mount(document.querySelector('#mount'),{surface:'preview'}).ready})()`)
      const frame = page.frames().find(item => item.url().includes('__sandbox.html'))!
      await frame.evaluate('window.originalLog = console.log')
      await page.evaluate('(async()=>{window.observer=session.debug.subscribe(()=>{});window.lost=observer.closed.catch(error=>error.code);await observer.ready})()')
      await frame.evaluate('console.log("private evidence")')
      await expect.poll(() => page.evaluate('session.debug.getSnapshot().items.map(item=>item.message)'), { timeout: 5000 }).toContain('private evidence')
      await frame.evaluate('window.dispatchEvent(new ErrorEvent("error",{message:"fatal error"}))')
      await expect.poll(() => page.evaluate('session.getSnapshot().runtime.status'), { timeout: 5000 }).not.toBe('ready')
      expect(await page.evaluate('session.debug.getSnapshot().items')).toEqual([])
      expect(['RUNTIME_CHANGED', 'SOURCE_UNAVAILABLE']).toContain(await page.evaluate('lost'))
      if (!frame.isDetached()) expect(await frame.evaluate('console.log === window.originalLog')).toBe(true)
      await page.evaluate('(async()=>{window.disposedSessionWeak=new WeakRef(window.session);await session.dispose();window.session=null})()')
      if (!process.env.HISTOIRE_EMBED_BROWSER || process.env.HISTOIRE_EMBED_BROWSER === 'chromium') {
        const cdp = await page.context().newCDPSession(page)
        try {
          await expect.poll(async () => {
            await cdp.send('HeapProfiler.collectGarbage')
            return page.evaluate('window.disposedSessionWeak.deref() === undefined')
          }, { timeout: 5000 }).toBe(true)
        }
        finally { await cdp.detach() }
      }
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
  it('denies a host allowed to embed but not observe diagnostics', async () => {
    const fixture = await createEmbedBridgeFixture({ story, inspection: 'same-origin', inspectionDiagnostics: true })
    const page = await fixture.browser.newPage()
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      const result = await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');const session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});try{await session.connect();await session.selection.select({storyId:'diagnostics',variantId:'one'});await session.mount(document.querySelector('#mount'),{surface:'preview'}).ready;try{session.debug.subscribe(()=>{});return 'allowed'}catch(error){return error.code}}finally{await session.dispose()}})()`)
      expect(result).toBe('CAPABILITY_UNAVAILABLE')
    }
    finally {
      await page.close()
      await fixture.close()
    }
  }, 120_000)
})
