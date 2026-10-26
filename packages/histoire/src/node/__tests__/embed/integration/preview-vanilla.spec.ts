import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'
import { attemptEmbedPrimary } from '../../utils/embed/primary-session.js'
import { warmEmbedSandbox } from '../../utils/embed/warm-source.js'

/** Existing built-in vanilla support uses DOM callbacks, not a host framework adapter. */
const vanilla = `
if(typeof window!=='undefined')window.__VANILLA_IMPORTS__=(window.__VANILLA_IMPORTS__||0)+1
function variant(id,count){return{id,title:id,onMount({el,state,onUpdate,onUnmount}){
  state.count=count;state.increment=()=>state.count+=2
  const button=document.createElement('button');const update=()=>button.textContent=id+':'+state.count
  const click=()=>state.increment();button.addEventListener('click',click);el.append(button);update()
  onUpdate(update);onUnmount(()=>button.removeEventListener('click',click))
}}}
export default{id:'vanilla',title:'Vanilla runtime',layout:{type:'grid'},variants:[variant('one',3),variant('two',4)]}
`

describe('built-in vanilla runtime embeddability', () => {
  it.each(['dev', 'static'] as const)('keeps data lazy and canonical callbacks isolated in %s', async (mode) => {
    const fixture = await createEmbedBridgeFixture({ mode, copiedOutput: mode === 'static', config: 'storyMatch:[\'*.story.js\'],', files: { 'Native.story.js': vanilla } })
    // Slow runners can finish cold dev optimization after mount readiness and
    // retire the session mid-test; a separate page settles it first.
    if (mode === 'dev') await warmEmbedSandbox(fixture.browser, fixture.bookUrl, { storyId: 'vanilla', variantId: 'one' }, 'one:3')
    const page = await fixture.browser.newPage({ viewport: { width: 1000, height: 750 } })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${fixture.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const{createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.catalog.getStory('vanilla');await session.source.get({storyId:'vanilla',mode:'raw'})})()`)
      expect(await page.evaluate('window.__VANILLA_IMPORTS__')).toBeUndefined()
      const bridge = page.frames().find(frame => frame.url().includes('__embed.html'))!
      expect(await bridge.evaluate('window.__VANILLA_IMPORTS__')).toBeUndefined()
      expect(page.frames().some(frame => frame.url().includes('__sandbox.html'))).toBe(false)
      await page.evaluate('session.selection.select({storyId:"vanilla",variantId:"one"})')
      let runtime: typeof bridge
      try {
        await page.evaluate('window.primary=session.mount(document.querySelector("#mount"),{surface:"preview"});primary.ready')
        runtime = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
        await expect.poll(() => runtime.getByRole('button', { name: 'one:3', exact: true }).count()).toBe(1)
      }
      catch (error) {
        const source = await page.evaluate('({status:session.getSnapshot().status,stale:session.getSnapshot().stale})')
        if (mode !== 'dev' || source.status !== 'disconnected' || !source.stale) throw error
        // Cold MSW optimization can reload source during mount readiness. Caller
        // explicitly closes retired resources before requesting a new session.
        await page.evaluate('session.dispose()')
        expect(await page.locator('iframe').count()).toBe(0)
        expect(await attemptEmbedPrimary(page, fixture.bookUrl, { storyId: 'vanilla', variantId: 'one' }, 'preview')).toBeNull()
        runtime = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
        await expect.poll(() => runtime.getByRole('button', { name: 'one:3', exact: true }).count()).toBe(1)
      }
      await page.evaluate('session.state.patch({count:7,increment:"invalid wire replacement"})')
      await runtime.getByRole('button', { name: 'one:7', exact: true }).click()
      await expect.poll(() => runtime.getByRole('button', { name: 'one:9', exact: true }).count()).toBe(1)
      await page.evaluate('session.state.reset()')
      await runtime.getByRole('button', { name: 'one:3', exact: true }).click()
      await expect.poll(() => runtime.getByRole('button', { name: 'one:5', exact: true }).count()).toBe(1)
      const retained = await page.evaluate('session.state.get()')
      expect(retained.target).toEqual({ storyId: 'vanilla', variantId: 'one' })
      expect(retained.value.count).toBe(5)
      // Another variant gets its own document with its own canonical callbacks.
      await page.evaluate('(async()=>{await session.selection.select({storyId:"vanilla",variantId:"two"});await session.state.patch({count:8})})()')
      const second = () => page.frames().find(frame => frame.url().includes('__sandbox.html') && new URL(frame.url()).searchParams.get('variantId') === 'two')
      await expect.poll(() => second()?.getByRole('button', { name: 'two:8', exact: true }).count()).toBe(1)
      await second()!.getByRole('button', { name: 'two:8', exact: true }).click()
      await expect.poll(() => second()?.getByRole('button', { name: 'two:10', exact: true }).count()).toBe(1)
      expect(await page.evaluate('window.__VANILLA_IMPORTS__')).toBeUndefined()
      await page.evaluate('session.dispose()')
      await expect.poll(() => page.locator('iframe').count()).toBe(0)
      expect(errors).toEqual([])
    }
    finally {
      await page.close()
      await fixture.close()
    }
  })
})
