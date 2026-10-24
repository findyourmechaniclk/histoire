import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

const story = `<template><Story id="frames"><Variant id="one"><button>one ok</button></Variant></Story></template>`

// Frame entry echoing host pings with its own actor id; evaluation is reported through a
// binding Playwright installs in every frame, whatever its origin.
const probe = `window.__frameProbe?.('evaluate')
export default { id: 'probe', apiVersion: 1, attach(frame) {
  frame.channel.on('ping', data => { void frame.channel.post('pong', { echo: data, actorId: frame.actorId }) })
} }
`

/**
 * Host script: one session per mount element, each rendering the same variant, with a channel to
 * the plugin actor of its own document collecting every pong it receives.
 */
function connect(bookUrl: string, mounts: string[]) {
  return `(async()=>{
  const {createHistoireSession}=await import('/sdk.js')
  window.sessions=[];window.pongs=[]
  for(const [index,id] of ${JSON.stringify(mounts)}.entries()){
    const element=document.getElementById(id)??document.body.appendChild(Object.assign(document.createElement('div'),{id}))
    const session=index===0&&window.dataOnly?window.dataOnly:createHistoireSession({url:${JSON.stringify(bookUrl)}})
    if(session!==window.dataOnly)await session.connect()
    await session.selection.select({storyId:'frames',variantId:'one'})
    await session.mount(element,{surface:'preview'}).ready
    await new Promise(resolve=>{const check=()=>session.plugins.actors('probe').length?resolve():setTimeout(check,20);check()})
    const [actor]=session.plugins.actors('probe')
    const channel=session.plugins.open('probe',actor)
    window.pongs[index]=[]
    channel.on('pong',data=>pongs[index].push(data))
    sessions.push({session,actor,channel})
  }
})()`
}

describe('frame plugin channels through the SDK', () => {
  it('round-trips with exactly one actor per session, same-origin and cross-origin', async () => {
    const fixture = await createEmbedBridgeFixture({
      story,
      files: { 'plugins/probe.js': probe },
      plugins: `{name:'probe',workbench:{id:'probe',apiVersion:1,frame:'./plugins/probe.js'}}`,
    })
    const page = await fixture.browser.newPage()
    const evaluations: string[] = []
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.exposeBinding('__frameProbe', ({ frame }) => {
        evaluations.push(frame.url())
      })
      for (const origin of [fixture.bookOrigin, fixture.hostOrigin]) {
        evaluations.length = 0
        await page.goto(`${origin}/host.html`)
        // Data-only connection: inventory from the descriptor, no story frame or module evaluated.
        expect(await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.dataOnly=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await dataOnly.connect();return dataOnly.plugins.frames()})()`)).toEqual([{ id: 'probe', apiVersion: 1 }])
        expect(page.frames().some(frame => frame.url().includes('__sandbox.html'))).toBe(false)
        expect(evaluations).toEqual([])
        await page.evaluate(connect(fixture.bookUrl, ['mount', 'mount-2']))
        expect(evaluations).toHaveLength(2)

        const actors = await page.evaluate('sessions.map(entry=>entry.actor.actorId)') as string[]
        expect(new Set(actors).size).toBe(2)
        await page.evaluate(`Promise.all(sessions.map((entry,index)=>entry.channel.post('ping',index)))`)
        await expect.poll(() => page.evaluate('pongs.map(list=>list.length)')).toEqual([1, 1])
        // Same variant, two frames: each session only hears its own actor.
        expect(await page.evaluate('pongs')).toEqual([[{ echo: 0, actorId: actors[0] }], [{ echo: 1, actorId: actors[1] }]])

        // Retiring the document retires the actor: later posts reject, nothing replays.
        await page.evaluate(`sessions[0].session.selection.select({storyId:'frames',variantId:null})`)
        expect(await page.evaluate(`sessions[0].channel.post('ping',2).then(()=>null,error=>error.code)`)).toBe('RUNTIME_CHANGED')
        expect(await page.evaluate(`(()=>{try{sessions[0].session.plugins.open('missing',sessions[0].actor)}catch(error){return error.code}})()`)).toBe('CAPABILITY_UNAVAILABLE')
        await page.evaluate('Promise.all(sessions.map(entry=>entry.session.dispose()))')
      }
      expect(errors).toEqual([])
    }
    finally {
      await page.close()
      await fixture.close()
    }
  })
})
