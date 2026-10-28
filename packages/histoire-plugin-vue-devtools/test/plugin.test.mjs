import assert from 'node:assert/strict'
import { createServer } from 'node:http'
// This package's small Node tests do not need a separate Vitest config.
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test'
import { HstVueDevtools } from '../dist/index.js'
import { sandboxDevtools } from '../dist/sandbox.js'

const client = { mode: 'dev', isServer: false, browserRuntime: false, collecting: false }

test('enables Vue DevTools only for interactive development servers', async () => {
  const plugin = HstVueDevtools()
  for (const context of [
    { ...client, mode: 'build' },
    { ...client, isServer: true },
    { ...client, browserRuntime: true },
    { ...client, collecting: true },
  ]) assert.equal(await plugin.viteConfig({}, context), undefined)
  assert.equal(await plugin.viteConfig({ devtools: false }, client), undefined)
  assert.equal(await HstVueDevtools({ enabled: false }).viteConfig({}, client), undefined)
  assert.equal(HstVueDevtools({ enabled: false }).workbench, undefined)
  assert.equal(plugin.workbench.devOnly, true)
  const result = await plugin.viteConfig({}, client)
  assert.equal(result.define.__HISTOIRE_VUE_DEVTOOLS_ACTIVE__, true)
  assert.equal(result.devtools.mcp, false)
  assert.equal(result.devtools.host, '127.0.0.1')
  assert.ok(result.plugins.flat().some(entry => entry.name === 'histoire:vue-devtools-sandbox'))
})

test('rejects short or non-printable automatic authentication tokens', () => {
  assert.throws(() => HstVueDevtools({ clientAuthToken: 'short' }), /Invalid Vue DevTools token/)
  assert.throws(() => HstVueDevtools({ clientAuthToken: `${'a'.repeat(32)}\n` }), /Invalid Vue DevTools token/)
})

test('keeps a token containing markup inside its script element', () => {
  const plugin = sandboxDevtools(`${'a'.repeat(32)}</script>`)
  const tags = plugin.transformIndexHtml.handler('', { path: '/__sandbox.html' })
  assert.ok(!tags[0].children.includes('</script>'))
  assert.ok(tags[0].children.includes('\\u003c/script>'))
})

test('does not inject a floating dock into story frames', () => {
  const plugin = sandboxDevtools()
  plugin.configResolved({ base: '/nested/', server: {} })
  const tags = plugin.transformIndexHtml.handler('', { path: '/nested/__sandbox.html' })
  assert.equal(tags.length, 0)
  assert.equal(plugin.transformIndexHtml.handler('', { path: '/nested/__embed.html' }).length, 0)
})

test('automatic token is never served by a wildcard listener', async (t) => {
  const plugin = sandboxDevtools('0123456789abcdef0123456789abcdef')
  let handler
  const server = createServer((request, response) => handler(request, response, () => response.end('allowed')))
  t.after(() => new Promise(resolve => server.close(resolve)))
  plugin.configureServer({ config: { server: { hmr: { server } } }, middlewares: { use: middleware => handler = middleware } })
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '0.0.0.0', resolve))
  const result = await fetch(`http://127.0.0.1:${server.address().port}/`)
  assert.equal(result.status, 403)
  assert.equal(await result.text(), 'Vue DevTools requires a loopback-only listener')
})

test('automatic token permits an actual loopback listener', async (t) => {
  const plugin = sandboxDevtools('0123456789abcdef0123456789abcdef')
  let handler
  const server = createServer((request, response) => handler(request, response, () => response.end('allowed')))
  t.after(() => new Promise(resolve => server.close(resolve)))
  plugin.configureServer({ config: { server: { hmr: { server } } }, middlewares: { use: middleware => handler = middleware } })
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const result = await fetch(`http://127.0.0.1:${server.address().port}/`)
  assert.equal(result.status, 200)
  assert.equal(await result.text(), 'allowed')
})
