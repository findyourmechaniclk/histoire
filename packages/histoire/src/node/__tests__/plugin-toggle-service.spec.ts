import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { createServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { closeContext, createContext } from '../context.js'
import { installUiHttpRouter } from '../server/ui-channel/http.js'
import { registerPluginToggleHttp } from '../server/ui-channel/plugin-toggle-http.js'
import { applyPluginChanges, pluginToggleStatus, validatePluginApply } from '../server/ui-channel/plugin-toggle-service.js'
import { resolvedConfig } from '../virtual/resolved-config.js'
import { configTestProject, disposeConfigProjects } from './utils/config-codemod.js'

const source = `import { one as First, two } from './plugins.js'
export default { plugins: [First({ /* preserve */ value: 1 }), two()] }
`

afterEach(disposeConfigProjects)

/** Uses actual config loading, plugin resolution and guarded disk writes. */
async function project(code = source, name = 'histoire.config.ts') {
  const fixture = await configTestProject(code, name)
  await writeFile(join(fixture.root, 'plugins.js'), `export function one(options) { return { name: 'one', metadata: { displayName: 'First' }, privateValue: 'private-secret', options } }; export function two() { return { name: 'two' } }`)
  return fixture
}

describe('plugin changes', () => {
  it.each(['histoire.config.ts', 'histoire.config.js'])('applies staged changes together and restores factories in %s', async (name) => {
    const fixture = await project(source, name)
    const first = await createContext({ root: fixture.root, mode: 'dev' })
    let successor: Awaited<ReturnType<typeof createContext>> | undefined
    let restored: Awaited<ReturnType<typeof createContext>> | undefined
    let staticContext: Awaited<ReturnType<typeof createContext>> | undefined
    try {
      const one = first.pluginInventory!.find(item => item.name === 'one')!
      const two = first.pluginInventory!.find(item => item.name === 'two')!
      expect(one.toggleId).toBeTruthy()
      expect(two.toggleId).toBeTruthy()
      const requestId = randomUUID()
      await applyPluginChanges(first, validatePluginApply({ requestId, changes: [{ id: one.toggleId, enabled: false }, { id: two.toggleId, enabled: false }] }), () => true)
      expect(await pluginToggleStatus(first, requestId)).toEqual({ completion: 'pending' })
      const written = await readFile(fixture.file, 'utf8')
      expect(written).toContain('First({ /* preserve */ value: 1 })')
      expect(written).not.toContain('private-secret')
      successor = await createContext({ root: fixture.root, mode: 'dev' })
      expect(await pluginToggleStatus(successor, requestId)).toEqual({ completion: 'saved' })
      expect(successor.pluginInventory!.filter(item => ['one', 'two'].includes(item.name)).map(item => [item.name, item.enabled])).toEqual([['one', false], ['two', false]])
      expect(resolvedConfig(successor)).not.toContain('private-secret')
      staticContext = await createContext({ root: fixture.root, mode: 'build' })
      expect(staticContext.pluginInventory!.filter(item => ['one', 'two'].includes(item.name)).map(item => [item.name, item.enabled, item.toggleId])).toEqual([['one', false, undefined], ['two', false, undefined]])
      const secondId = randomUUID()
      await applyPluginChanges(successor, validatePluginApply({ requestId: secondId, changes: successor.pluginInventory!.filter(item => ['one', 'two'].includes(item.name)).map(item => ({ id: item.toggleId, enabled: true })) }), () => true)
      restored = await createContext({ root: fixture.root, mode: 'dev' })
      expect(await pluginToggleStatus(restored, secondId)).toEqual({ completion: 'saved' })
      expect(await readFile(fixture.file, 'utf8')).toBe(source)
    }
    finally {
      await closeContext(first)
      if (successor) await closeContext(successor)
      if (restored) await closeContext(restored)
      if (staticContext) await closeContext(staticContext)
    }
  })

  it('refuses duplicate identities and dynamic arrays without changing inventory', async () => {
    const fixture = await project(`import { one } from './plugins.js'; export default { plugins: [one(), one()] }`)
    const duplicate = await createContext({ root: fixture.root, mode: 'dev' })
    try {
      const rows = duplicate.pluginInventory!.filter(item => item.name === 'one')
      expect(rows).toHaveLength(2)
      expect(rows.every(row => !row.toggleId)).toBe(true)
    }
    finally { await closeContext(duplicate) }
    await writeFile(fixture.file, `import { one } from './plugins.js'; const plugins = [one()]; export default { plugins }`)
    const dynamic = await createContext({ root: fixture.root, mode: 'dev' })
    try {
      expect(dynamic.pluginInventory!.find(item => item.name === 'one')?.toggleId).toBeUndefined()
    }
    finally { await closeContext(dynamic) }
  })

  it('does not evaluate a disabled factory when loading the next context', async () => {
    const fixture = await project()
    const initial = await createContext({ root: fixture.root, mode: 'dev' })
    try {
      const row = initial.pluginInventory!.find(item => item.name === 'one')!
      await applyPluginChanges(initial, { requestId: randomUUID(), changes: [{ id: row.toggleId!, enabled: false }] }, () => true)
      await writeFile(join(fixture.root, 'plugins.js'), `export function one() { throw new Error('disabled factory was evaluated') }; export function two() { return { name: 'two' } }`)
      const successor = await createContext({ root: fixture.root, mode: 'dev' })
      try {
        expect(successor.pluginInventory!.find(item => item.name === 'one')?.enabled).toBe(false)
      }
      finally { await closeContext(successor) }
    }
    finally { await closeContext(initial) }
  })

  it('rejects stale disk revisions without overwriting changes', async () => {
    const fixture = await project()
    const ctx = await createContext({ root: fixture.root, mode: 'dev' })
    try {
      const row = ctx.pluginInventory!.find(item => item.name === 'one')!
      const modified = `${source}\n// concurrent change\n`
      await writeFile(fixture.file, modified)
      await expect(applyPluginChanges(ctx, { requestId: randomUUID(), changes: [{ id: row.toggleId!, enabled: false }] }, () => true)).rejects.toThrow('Config changed on disk')
      expect(await readFile(fixture.file, 'utf8')).toBe(modified)
    }
    finally { await closeContext(ctx) }
  })

  it('serializes overlapping submissions and rejects later config changes during confirmation', async () => {
    const fixture = await project()
    const ctx = await createContext({ root: fixture.root, mode: 'dev' })
    let successor: Awaited<ReturnType<typeof createContext>> | undefined
    try {
      const one = ctx.pluginInventory!.find(item => item.name === 'one')!
      const two = ctx.pluginInventory!.find(item => item.name === 'two')!
      const firstId = randomUUID()
      const results = await Promise.allSettled([
        applyPluginChanges(ctx, { requestId: firstId, changes: [{ id: one.toggleId!, enabled: false }] }, () => true),
        applyPluginChanges(ctx, { requestId: randomUUID(), changes: [{ id: two.toggleId!, enabled: false }] }, () => true),
      ])
      expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected'])
      const saved = await readFile(fixture.file, 'utf8')
      expect(saved).toContain('two()')
      await writeFile(fixture.file, `${saved}\n// concurrent change\n`)
      successor = await createContext({ root: fixture.root, mode: 'dev' })
      expect(await pluginToggleStatus(successor, firstId)).toMatchObject({ completion: 'failed', error: expect.stringContaining('changed on disk') })
    }
    finally {
      await closeContext(ctx)
      if (successor) await closeContext(successor)
    }
  })

  it('does not confirm a disable when another plugin makes it active again', async () => {
    const fixture = await project()
    const ctx = await createContext({ root: fixture.root, mode: 'dev' })
    let successor: Awaited<ReturnType<typeof createContext>> | undefined
    try {
      const row = ctx.pluginInventory!.find(item => item.name === 'one')!
      const requestId = randomUUID()
      await applyPluginChanges(ctx, { requestId, changes: [{ id: row.toggleId!, enabled: false }] }, () => true)
      await writeFile(join(fixture.root, 'plugins.js'), `export function one() { return { name: 'one' } }; export function two() { return { name: 'two', config() { return { plugins: [{ name: 'one' }] } } } }`)
      successor = await createContext({ root: fixture.root, mode: 'dev' })
      expect(await pluginToggleStatus(successor, requestId)).toMatchObject({ completion: 'failed', error: expect.stringContaining('not effective') })
    }
    finally {
      await closeContext(ctx)
      if (successor) await closeContext(successor)
    }
  })

  it('rejects arbitrary request fields and duplicate selections', () => {
    const id = randomUUID()
    expect(() => validatePluginApply({ requestId: randomUUID(), changes: [{ id, enabled: false }], source: 'secret' })).toThrow()
    expect(() => validatePluginApply({ requestId: randomUUID(), changes: [{ id, enabled: false }, { id, enabled: true }] })).toThrow()
  })

  it('rejects cross-origin writes and confirms a same-origin change through the successor route', async () => {
    const fixture = await project()
    const ctx = await createContext({ root: fixture.root, mode: 'dev' })
    const server = await createServer({ root: fixture.root, base: '/book/', configFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true }, server: { port: 0, host: '127.0.0.1', hmr: false }, plugins: [{ name: 'ui-http-boundary', configureServer: installUiHttpRouter }] })
    let remove = registerPluginToggleHttp(ctx, server, () => true)
    let successor: Awaited<ReturnType<typeof createContext>> | undefined
    try {
      await server.listen()
      const origin = new URL(server.resolvedUrls!.local[0]).origin
      const endpoint = `${origin}/book/__histoire/plugins/toggle`
      const requestId = randomUUID()
      const row = ctx.pluginInventory!.find(item => item.name === 'one')!
      const body = JSON.stringify({ action: 'apply', requestId, changes: [{ id: row.toggleId, enabled: false }] })
      const refused = await fetch(endpoint, { method: 'POST', headers: { 'origin': 'https://evil.example', 'content-type': 'application/json' }, body })
      expect(refused.status).toBe(403)
      expect(await readFile(fixture.file, 'utf8')).toBe(source)
      const accepted = await fetch(endpoint, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body })
      expect(await accepted.json()).toEqual({ completion: 'pending' })
      remove()
      successor = await createContext({ root: fixture.root, mode: 'dev' })
      remove = registerPluginToggleHttp(successor, server, () => true)
      const status = await fetch(endpoint, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status', requestId }) })
      expect(await status.json()).toEqual({ completion: 'saved' })
    }
    finally {
      remove()
      await server.close()
      await closeContext(ctx)
      if (successor) await closeContext(successor)
    }
  })
})
