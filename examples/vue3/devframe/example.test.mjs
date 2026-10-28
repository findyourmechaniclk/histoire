import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
// The example smoke test uses Node's built-in runner and needs no Vitest config.
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { chromium } from 'playwright'

/** Reserve an available loopback port for the example process. */
async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  await new Promise(resolve => server.close(resolve))
  return port
}

/** Read only the temporary agent credential once startup completes. */
async function waitForToken(child) {
  return await new Promise((resolve, reject) => {
    let output = ''
    // Function declarations below are hoisted for the shared cleanup path.
    // eslint-disable-next-line ts/no-use-before-define
    const timeout = setTimeout(() => finish(new Error('Example startup timed out')), 60000)
    /** Unsubscribe after the first terminal result. */
    function finish(error, token) {
      clearTimeout(timeout)
      child.stdout.off('data', read) // eslint-disable-line ts/no-use-before-define
      child.off('exit', exited) // eslint-disable-line ts/no-use-before-define
      if (error) reject(error)
      else resolve(token)
    }
    /** Wait for the complete credential line without printing it. */
    function read(chunk) {
      output += chunk.toString()
      const match = output.match(/MCP Authorization header: Bearer (\S+)\n/)
      if (match) finish(undefined, match[1])
    }
    /** Surface startup failure without leaking credentials. */
    function exited(code) {
      finish(new Error(`Example exited during startup: ${code}`))
    }
    child.stdout.on('data', read)
    child.once('exit', exited)
  })
}

/** Expand the Vue component tree and select the example counter. */
async function selectCounter(panel) {
  const counter = panel.getByRole('treeitem').filter({ hasText: 'DevframeCounter' })
  const apps = panel.getByRole('button', { name: /RenderStorySubApp \(/ })
  await apps.first().waitFor({ timeout: 30000 })
  for (let app = 0; app < await apps.count(); app++) {
    await apps.nth(app).click()
    const deadline = Date.now() + 8000
    while (Date.now() < deadline && await counter.count() === 0) {
      const expand = panel.getByRole('treeitem').getByRole('button', { name: 'Expand' }).first()
      if (await expand.count()) {
        const rows = await panel.getByRole('treeitem').count()
        await expand.click()
        const limit = Math.min(deadline, Date.now() + 1000)
        while (Date.now() < limit && await panel.getByRole('treeitem').count() <= rows) await delay(100)
      }
      else {
        await delay(100)
      }
    }
    if (await counter.count()) {
      await counter.click()
      return
    }
  }
  throw new Error('Vue DevTools did not expose the example counter')
}

test('Vue DevTools and MCP inspect the mounted example story', { timeout: 120000 }, async (t) => {
  const port = await availablePort()
  const origin = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, HISTOIRE_DEVFRAME_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  // Drain both streams while keeping the generated credential out of test logs.
  child.stderr.resume()
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      let timer
      await Promise.race([once(child, 'exit'), new Promise((resolve) => {
        timer = setTimeout(resolve, 5000)
      })])
      clearTimeout(timer)
      if (child.exitCode === null) child.kill('SIGKILL')
    }
  })
  const token = await waitForToken(child)
  child.stdout.resume()
  const browser = await chromium.launch({ headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage()
  await page.goto(origin)
  await page.getByText('Connected. Change the counter, then inspect it through MCP.').waitFor({ timeout: 30000 })
  const story = page.frames().find(frame => frame.url().includes('__sandbox.html'))
  assert.ok(story)
  await story.getByRole('button', { name: 'Count 0' }).click()
  assert.equal(await story.locator('devframes-dock-embedded').count(), 0)
  assert.equal(await page.frames().filter(frame => frame.url().includes('__embed.html')).reduce(async (previous, frame) => (await previous) + await frame.locator('devframes-dock-embedded').count(), Promise.resolve(0)), 0)

  const agent = new Client({ name: 'vue3-example-test', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } })
  t.after(() => agent.close())
  await agent.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }))
  const resources = await agent.listResources()
  assert.equal(resources.resources.length, 1)
  const resource = await agent.readResource({ uri: resources.resources[0].uri })
  const record = JSON.parse(resource.contents[0].text)
  const result = await agent.callTool({ name: 'histoire_inspect_session', arguments: { attachmentId: record.attachmentId, target: record.owner.target, expectedOwner: record.owner, kind: 'variant' } })
  assert.equal(result.isError, undefined)
  assert.equal(result.structuredContent.state.count, 1)
  const unauthorized = await fetch(`${origin}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(unauthorized.status, 401)

  const { bookUrl } = await page.evaluate(() => fetch('/demo/config').then(response => response.json()))
  const workbench = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  t.after(() => workbench.close())
  await workbench.goto(`${bookUrl}story/devframe-example?variantId=counter&tab=vue-devtools:vue`)
  const panelElement = workbench.locator('iframe[title="Vue DevTools"]')
  await panelElement.waitFor({ timeout: 30000 })
  const panel = workbench.frameLocator('iframe[title="Vue DevTools"]')
  await selectCounter(panel)
  await panel.getByText('"First counter"', { exact: true }).waitFor({ timeout: 15000 })
  const workbenchStory = workbench.frameLocator('.histoire-canvas-frame.is-selected iframe[title="Histoire variant"]')
  await workbenchStory.getByRole('button', { name: 'Count 0' }).click()
  await panel.getByText('1', { exact: true }).first().waitFor({ timeout: 15000 })
  assert.equal(await workbenchStory.locator('devframes-dock-embedded').count(), 0)
  const oldPanel = await panelElement.elementHandle()
  await workbench.evaluate(() => {
    history.pushState({}, '', '?variantId=second&tab=vue-devtools:vue')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await workbench.waitForFunction(element => !element.isConnected, oldPanel, { timeout: 15000 })
  await panelElement.waitFor({ timeout: 15000 })
  await selectCounter(panel)
  await panel.getByText('"Second counter"', { exact: true }).waitFor({ timeout: 15000 })
  assert.equal(await panel.getByText('"First counter"', { exact: true }).count(), 0)
})
