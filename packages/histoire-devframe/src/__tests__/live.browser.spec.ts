import type { Route } from 'playwright'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { initDevframe } from 'devframe/initiate'
import { build } from 'esbuild'
import { expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../../histoire/src/node/__tests__/utils/embed/bridge-fixture.js'
import { createDevframeBridge } from '../node/devframe.js'
import { createMcpEndpoint } from '../node/mcp.js'

const story = `<script setup>import {logEvent} from 'histoire/client';import Probe from './Probe.vue';function initial(){return {count:3}};function clicked(state){state.count++;logEvent('Changed',state.count);console.warn('adapter diagnostic marker')}</script><template><Story id="inspection" title="Inspection"><Variant id="one" :init-state="initial"><template #default="{state}"><button data-testid="counter" @click="clicked(state)">Count {{state.count}}</button><Probe label="sample"/><img src="data:image/png;base64,iVBORw0KGgo="/></template></Variant></Story></template>`

it('reads unsaved mounted state and real component events through browser, Devframe and MCP', async () => {
  const bundle = await build({ stdin: { contents: `export {attachDevframe} from './src/client/index.ts'; export {getDevframeRpcClient} from 'devframe/client'`, resolveDir: fileURLToPath(new URL('../../', import.meta.url)), sourcefile: 'entry.ts' }, bundle: true, platform: 'browser', format: 'esm', write: false })
  const fixture = await createEmbedBridgeFixture({ story, files: { 'Probe.vue': '<script setup>defineProps({label:String})</script><template><button data-testid="probe">{{label}}</button></template>' }, inspection: 'host', inspectionComponents: true, inspectionAccessibility: true, inspectionDiagnostics: true, hostModules: { '/adapter.js': { body: bundle.outputFiles[0].text } } })
  let otherFixture: Awaited<ReturnType<typeof createEmbedBridgeFixture>>
  try {
    otherFixture = await createEmbedBridgeFixture({ story, files: { 'Probe.vue': '<script setup>defineProps({label:String})</script><template><button data-testid="probe">{{label}}</button></template>' }, inspection: 'host', hostModules: { '/adapter.js': { body: bundle.outputFiles[0].text } } })
  }
  catch (error) {
    await fixture.close()
    throw error
  }
  const browserToken = randomUUID()
  const secondBrowserToken = randomUUID()
  const agentToken = randomUUID()
  const secondAgentToken = randomUUID()
  const browserPrincipals = new Map([[browserToken, 'alice'], [secondBrowserToken, 'bob']])
  const agentPrincipals = new Map([[agentToken, 'alice'], [secondAgentToken, 'bob']])
  let authority = 0
  const principals = new Map<number, string>()
  let heldAuthorization: { scope: string, checks: number, entered: () => void, release: Promise<void> } | undefined
  const bridge = createDevframeBridge({
    identifyPeer: peer => principals.get(peer.meta.id),
    verifyAttachment: async (peer, identity, url) => {
      const principal = principals.get(peer.meta.id)
      const matches = principal === 'alice' ? url === fixture.bookUrl && identity.projectId === 'project-a' : principal === 'bob' && url === otherFixture.bookUrl && identity.projectId === 'project-b'
      if (!matches) throw new Error('Denied')
      return { identity, scopes: ['inspection', 'events', 'diagnostics', 'components', 'accessibility', 'highlight'] }
    },
    isCurrent: () => true,
    authorityVersion: () => authority,
    allowSource: url => url === fixture.bookUrl || url === otherFixture.bookUrl,
    authorize: async ({ principal, attachment, capability }) => {
      const held = heldAuthorization
      if (held && capability === held.scope && ++held.checks === 2) {
        heldAuthorization = undefined
        held.entered()
        await held.release
        return false
      }
      return principal === attachment.principal
    },
  })
  const endpoint = createMcpEndpoint(bridge.broker, request => agentPrincipals.get((request.headers.get('authorization') ?? '').replace(/^Bearer /, '')))
  const dispatch = toNodeHandler(endpoint)
  let instance: ReturnType<typeof initDevframe> | undefined
  const server = createServer((request, response) => {
    if (request.url?.includes('__connection.json') && [fixture.hostOrigin, otherFixture.hostOrigin].includes(request.headers.origin ?? '')) response.setHeader('Access-Control-Allow-Origin', request.headers.origin!)
    if (request.url?.startsWith('/mcp')) {
      void dispatch(request, response)
    }
    else { instance!.nodeMiddleware(request, response) }
  })
  const agent = new Client({ name: 'test-agent', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
  const page = await fixture.browser.newPage()
  const secondPage = await otherFixture.browser.newPage()
  const secondAgent = new Client({ name: 'second-agent', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    instance = initDevframe(bridge.definition, { base: '/nested/histoire/', server, distDir: false, mcp: false, register: false, origin, allowedOrigins: [fixture.hostOrigin, otherFixture.hostOrigin], auth: {
      rpcFunctions: [{ name: 'anonymous:devframe:auth', type: 'action', setup: ctx => ({ handler: () => ({ isTrusted: ctx.rpc.getCurrentRpcSession()?.meta.isTrusted === true }) }) }],
      authorize: (name, session) => name.startsWith('anonymous:') || session.meta.isTrusted === true,
      onConnect(connection, session) {
        const token = new URL(connection.request?.url ?? '/', origin).searchParams.get('devframe_auth_token')
        const principal = token ? browserPrincipals.get(token) : undefined
        session.meta.isTrusted = !!principal
        if (principal) principals.set(session.meta.id, principal)
      },
      printBanner() {},
    }, onPeerDisconnect: (_connection, meta) => {
      bridge.onPeerDisconnect(meta)
      principals.delete(meta.id)
    } })
    await instance.ready
    const grant = bridge.broker.createGrant({ principal: 'alice', sourceUrl: fixture.bookUrl, scopes: ['inspection', 'events', 'diagnostics', 'components', 'accessibility', 'highlight'] })
    await page.goto(`${fixture.hostOrigin}/host.html`)
    await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');const {getDevframeRpcClient,attachDevframe}=await import('/adapter.js');window.session=createHistoireSession({url:${JSON.stringify(fixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'inspection',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready;window.connection=await getDevframeRpcClient({baseURL:${JSON.stringify(`${origin}/nested/histoire/`)},authToken:${JSON.stringify(browserToken)},webmcp:false,simpleAuth:false,otpParam:false,callTimeout:3000});await connection.ensureTrusted();window.attachment=await attachDevframe({session,connection,grant:${JSON.stringify(grant.token)},projectId:'project-a',scopes:['inspection','events','diagnostics','components','accessibility','highlight']})})()`)
    const secondGrant = bridge.broker.createGrant({ principal: 'bob', sourceUrl: otherFixture.bookUrl, scopes: ['inspection'] })
    await secondPage.goto(`${otherFixture.hostOrigin}/host.html`)
    await secondPage.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');const {getDevframeRpcClient,attachDevframe}=await import('/adapter.js');window.session=createHistoireSession({url:${JSON.stringify(otherFixture.bookUrl)}});await session.connect();await session.selection.select({storyId:'inspection',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready;window.connection=await getDevframeRpcClient({baseURL:${JSON.stringify(`${origin}/nested/histoire/`)},authToken:${JSON.stringify(secondBrowserToken)},webmcp:false,simpleAuth:false,otpParam:false,callTimeout:3000});await connection.ensureTrusted();window.attachment=await attachDevframe({session,connection,grant:${JSON.stringify(secondGrant.token)},projectId:'project-b',scopes:['inspection']})})()`)
    await secondAgent.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { authorization: `Bearer ${secondAgentToken}` } } }))
    const frame = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
    await frame.getByTestId('counter').click()
    await expect.poll(() => page.evaluate('session.getSnapshot().events.items.length')).toBeGreaterThan(0)
    await agent.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { authorization: `Bearer ${agentToken}` } } }))
    const [attachment] = await bridge.broker.list('alice')
    expect(attachment).toBeDefined()
    const [secondAttachment] = await bridge.broker.list('bob')
    expect(secondAttachment).toBeDefined()
    expect(secondAttachment.sourceUrl).toBe(otherFixture.bookUrl)
    expect(attachment.sourceUrl).toBe(fixture.bookUrl)
    expect((await agent.listResources()).resources.map(item => item.uri)).toEqual([`histoire://live/${attachment.attachmentId}`])
    expect((await secondAgent.listResources()).resources.map(item => item.uri)).toEqual([`histoire://live/${secondAttachment.attachmentId}`])
    const args = { attachmentId: attachment.attachmentId, target: attachment.owner.target, expectedOwner: attachment.owner }
    const secondArgs = { attachmentId: secondAttachment.attachmentId, target: secondAttachment.owner.target, expectedOwner: secondAttachment.owner }
    const otherValue = await secondAgent.callTool({ name: 'histoire_inspect_session', arguments: { ...secondArgs, kind: 'variant' } })
    expect(otherValue.structuredContent).toMatchObject({ mode: 'live', state: { count: 3 } })
    const denied = await secondAgent.callTool({ name: 'histoire_inspect_session', arguments: { ...args, kind: 'variant' } })
    expect(denied.isError).toBe(true)
    const result = await agent.callTool({ name: 'histoire_inspect_session', arguments: { ...args, kind: 'variant' } })
    expect(result.isError).not.toBe(true)
    expect(result.structuredContent).toMatchObject({ mode: 'live', state: { count: 4 }, owner: { target: { storyId: 'inspection', variantId: 'one' } } })
    const events = await agent.callTool({ name: 'histoire_get_session_events', arguments: args })
    expect(events.isError).not.toBe(true)
    expect((events.structuredContent as any).items.length).toBeGreaterThan(0)
    await expect.poll(async () => {
      const diagnostics = await agent.callTool({ name: 'histoire_get_session_diagnostics', arguments: args })
      return (diagnostics.structuredContent as any)?.items?.some((item: any) => item.message.includes('adapter diagnostic marker')) ?? false
    }, { timeout: 10_000 }).toBe(true)
    const tree = await agent.callTool({ name: 'histoire_inspect_component', arguments: args })
    expect(tree.isError).not.toBe(true)
    expect((tree.structuredContent as any).nodes.length).toBeGreaterThan(0)
    const element = await agent.callTool({ name: 'histoire_inspect_component', arguments: { ...args, selector: '[data-testid=probe]' } })
    expect(element.structuredContent).toMatchObject({ inspection: 'componentForElement', node: { name: 'Probe' } })
    const componentId = (element.structuredContent as any).node.id
    const detail = await agent.callTool({ name: 'histoire_inspect_component', arguments: { ...args, componentId } })
    expect(detail.structuredContent).toMatchObject({ inspection: 'component', props: { label: 'sample' } })
    const audit = await agent.callTool({ name: 'histoire_audit_session_accessibility', arguments: args })
    expect(audit.structuredContent).toMatchObject({ inspection: 'accessibility', engine: 'axe-core', matched: true })
    expect((audit.structuredContent as any).violations.map((item: any) => item.id)).toContain('image-alt')
    const highlight = await agent.callTool({ name: 'histoire_highlight_element', arguments: { ...args, selector: '[data-testid=counter]', durationMs: 300 } })
    expect(highlight.isError).not.toBe(true)
    expect(highlight.structuredContent).toMatchObject({ owner: attachment.owner })
    // Hold final broker authorization after a real overlay exists, then deny it.
    for (const locator of [{ componentId }, { selector: '[data-testid=probe]' }]) {
      const entered = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      heldAuthorization = { scope: 'highlight', checks: 0, entered: entered.resolve, release: release.promise }
      try {
        const pending = agent.callTool({ name: 'histoire_highlight_element', arguments: { ...args, ...locator, durationMs: 5000 } })
        await entered.promise
        const overlay = frame.locator('[data-histoire-inspection-highlight]')
        await expect.poll(() => overlay.count()).toBe(1)
        release.resolve()
        expect((await pending).isError).toBe(true)
        await expect.poll(() => overlay.count()).toBe(0)
      }
      finally {
        heldAuthorization = undefined
        release.resolve()
      }
    }
    // Denying an older call cannot clear a newer highlight's lease.
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    heldAuthorization = { scope: 'components', checks: 0, entered: entered.resolve, release: release.promise }
    try {
      const old = agent.callTool({ name: 'histoire_highlight_element', arguments: { ...args, componentId, durationMs: 5000 } })
      await entered.promise
      const overlay = frame.locator('[data-histoire-inspection-highlight]')
      await expect.poll(() => overlay.count()).toBe(1)
      const successor = await agent.callTool({ name: 'histoire_highlight_element', arguments: { ...args, selector: '[data-testid=counter]', durationMs: 5000 } })
      expect(successor.isError).not.toBe(true)
      const successorRect = await overlay.boundingBox()
      const counterRect = await frame.getByTestId('counter').boundingBox()
      expect(successorRect).toEqual(counterRect)
      release.resolve()
      expect((await old).isError).toBe(true)
      expect(await overlay.boundingBox()).toEqual(counterRect)
    }
    finally {
      heldAuthorization = undefined
      release.resolve()
    }
    expect(await page.evaluate('session.getSnapshot().selection')).toEqual({ storyId: 'inspection', variantId: 'one' })
    expect(page.frames().filter(frame => frame.url().includes('__sandbox.html'))).toHaveLength(1)
    // Hold a real origin-policy response after the mounted runtime replies, then withdraw the exact attachment.
    const held = Promise.withResolvers<void>()
    let policyReads = 0
    const pattern = '**/histoire-embed-origins.json'
    const holdPolicy = async (route: Route) => {
      if (++policyReads === 2) await held.promise
      await route.fulfill({ status: 404, body: '' }).catch(() => {})
    }
    await secondPage.route(pattern, holdPolicy)
    try {
      const pending = secondAgent.callTool({ name: 'histoire_inspect_session', arguments: { ...secondArgs, kind: 'variant' } })
      await expect.poll(() => policyReads, { timeout: 10_000 }).toBeGreaterThanOrEqual(2)
      authority++
      bridge.invalidate(secondAttachment.attachmentId)
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const outcome = await Promise.race([pending, new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Revoked request did not settle promptly')), 1000)
        })])
        expect(outcome.isError).toBe(true)
      }
      finally { clearTimeout(timer) }
      const survivor = await agent.callTool({ name: 'histoire_inspect_session', arguments: { ...args, kind: 'variant' } })
      expect(survivor.structuredContent).toMatchObject({ state: { count: 4 } })
    }
    finally {
      held.resolve()
      await secondPage.unroute(pattern, holdPolicy)
    }
    // A malformed deployed policy makes a real subsequent diagnostic poll fail while the document stays mounted.
    let diagnosticPolicyReads = 0
    const denyPolicy = async (route: Route) => {
      diagnosticPolicyReads++
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
    await page.route(pattern, denyPolicy)
    try {
      await expect.poll(async () => (await agent.callTool({ name: 'histoire_get_session_diagnostics', arguments: args })).isError === true, { timeout: 10_000 }).toBe(true)
      expect(diagnosticPolicyReads).toBeGreaterThan(0)
      expect(await page.evaluate('session.getSnapshot().runtime.status')).toBe('ready')
      const lost = await agent.callTool({ name: 'histoire_get_session_diagnostics', arguments: args })
      expect(lost.structuredContent).toMatchObject({ ok: false, error: { code: 'SESSION_UNAVAILABLE' } })
    }
    finally { await page.unroute(pattern, denyPolicy) }
    // Re-pair after diagnostic policy loss, then retire more leases than the SDK's concurrent request limit.
    const retiringGrant = bridge.broker.createGrant({ principal: 'alice', sourceUrl: fixture.bookUrl, scopes: ['components', 'highlight'] })
    await page.evaluate(`(async()=>{const {attachDevframe}=await import('/adapter.js');window.attachment=await attachDevframe({session,connection,grant:${JSON.stringify(retiringGrant.token)},projectId:'project-a',scopes:['components','highlight']})})()`)
    const [retiringAttachment] = await bridge.broker.list('alice')
    const retiringArgs = { ...args, attachmentId: retiringAttachment.attachmentId }
    for (let index = 0; index < 18; index++) {
      const retiringHighlight = await agent.callTool({ name: 'histoire_highlight_element', arguments: { ...retiringArgs, componentId, durationMs: 5000 } })
      expect(retiringHighlight.isError).not.toBe(true)
    }
    const retiringOverlay = frame.locator('[data-histoire-inspection-highlight]')
    await expect.poll(() => retiringOverlay.count()).toBe(1)
    bridge.invalidate(retiringAttachment.attachmentId)
    await expect.poll(() => retiringOverlay.count(), { timeout: 3000 }).toBe(0)
    await page.evaluate('(async()=>{await attachment.dispose().catch(()=>{});connection.close();await session.dispose()})()')
    await secondPage.evaluate('(async()=>{await attachment.dispose().catch(()=>{});connection.close();await session.dispose()})()')
  }
  finally {
    await agent.close()
    await secondAgent.close()
    await page.close()
    await secondPage.close()
    await endpoint.close()
    await bridge.dispose().catch(() => {})
    await instance?.close()
    if (server.listening) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
    }
    await fixture.close()
    await otherFixture.close()
  }
}, 120_000)
