import type { ViteDevServer } from 'vite'
import type { Context } from '../context.js'
import type { CollectionEvidence } from '../test/eligibility/evidence.js'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { createServer } from 'vite'
import { afterEach, expect, it } from 'vitest'
import { attachTestCollectionEligibility, captureTestCollectionEligibility, captureTestCollectionGeneration } from '../test/eligibility/index.js'
import { collectionEligibilityTransformPlugin } from '../test/eligibility/transforms.js'
import { GENERATED_GLOBAL_SETUP, RESOLVED_GENERATED_GLOBAL_SETUP, SETUP_ID } from '../virtual/index.js'

/** Mutable bytes of the plugin-owned virtual leaf, like a Nuxt `#build` template. */
let virtualData = 'export const preference = "system"'
const disposers: (() => Promise<void>)[] = []
afterEach(async () => {
  virtualData = 'export const preference = "system"'
  await Promise.all(disposers.splice(0).map(dispose => dispose()))
})

/**
 * Real Vite resolution/transforms over two stories sharing a setup graph that,
 * like Nuxt setups, reaches an installed package and a plugin virtual module.
 */
async function createProject() {
  const root = await mkdtemp(join(tmpdir(), 'histoire-collection-evidence-'))
  await mkdir(join(root, 'node_modules/installed'), { recursive: true })
  await writeFile(join(root, 'node_modules/installed/package.json'), '{"name":"installed","type":"module","exports":"./index.js"}')
  await writeFile(join(root, 'node_modules/installed/index.js'), 'export const installed = 1')
  await writeFile(join(root, 'setup.js'), 'import "installed";import "virtual:data";export const setup = true')
  for (const id of ['a', 'b']) {
    await writeFile(join(root, `shared-${id}.js`), `export const ${id} = 1`)
    await writeFile(join(root, `${id}.story.js`), `import "./shared-${id}.js";export default {}`)
  }
  await writeFile(join(root, 'unrelated.ts'), 'export const unrelated = 1')
  const ctx = { root, storyFiles: ['a', 'b'].map(id => ({ id, path: join(root, `${id}.story.js`), story: { id, title: id, variants: [{ id: 'main', title: 'Main' }] } })) } as unknown as Context
  const server: ViteDevServer = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [collectionEligibilityTransformPlugin(ctx), {
      name: 'collection-evidence-fixture',
      /** Production setup ids resolve to this fixture's real setup graph. */
      resolveId(id) {
        if (id === SETUP_ID) return join(root, 'setup.js')
        if (id === GENERATED_GLOBAL_SETUP) return RESOLVED_GENERATED_GLOBAL_SETUP
        if (id === 'virtual:data') return '\0virtual:data'
      },
      /** Virtual bytes change without any watcher event. */
      load(id) {
        if (id === RESOLVED_GENERATED_GLOBAL_SETUP) return 'export {}'
        if (id === '\0virtual:data') return virtualData
      },
    }],
  })
  attachTestCollectionEligibility(ctx, server)
  disposers.push(async () => {
    await server.close()
    await rm(root, { recursive: true, force: true })
  })
  /** Verify through a fresh operation, as each collection request does. */
  const verify = (evidence: CollectionEvidence | undefined) => evidence ? captureTestCollectionGeneration(ctx)!.verify(evidence) : Promise.resolve(false)
  return { ctx, root, server, verify }
}

it('admits stories whose setup reaches installed packages and import-free virtual modules', async () => {
  const { ctx, verify } = await createProject()
  const proof = await captureTestCollectionEligibility(ctx)
  expect([...proof.evidence.keys()].sort()).toEqual(['a', 'b'])
  expect(await verify(proof.evidence.get('a'))).toBe(true)
})

it('retires only stories whose graph contains an edited module', async () => {
  const { ctx, root, server, verify } = await createProject()
  const proof = await captureTestCollectionEligibility(ctx)
  const inFlight = captureTestCollectionGeneration(ctx)!
  server.watcher.emit('all', 'change', join(root, 'shared-a.js'))
  expect(await verify(proof.evidence.get('a'))).toBe(false)
  expect(await verify(proof.evidence.get('b'))).toBe(true)
  // Work mounted from the old graph must not publish after the edit.
  expect(() => inFlight.assertCurrent()).toThrow()
})

// Hidden build dirs (another Nuxt process regenerating `.nuxt/`) are never part of a graph.
it.each([['change', 'unrelated.ts'], ['add', '.nuxt/ui/button.ts'], ['unlink', '.nuxt/tsconfig.json']])('keeps evidence and in-flight operations through %s of %s outside every graph', async (event, file) => {
  const { ctx, root, server, verify } = await createProject()
  const proof = await captureTestCollectionEligibility(ctx)
  const inFlight = captureTestCollectionGeneration(ctx)!
  server.watcher.emit('all', event, join(root, file))
  expect(await verify(proof.evidence.get('a'))).toBe(true)
  expect(await verify(proof.evidence.get('b'))).toBe(true)
  expect(() => inFlight.assertCurrent()).not.toThrow()
})

it.each([['add', 'new.ts'], ['unlink', 'unrelated.ts'], ['change', 'tsconfig.json']])('retires every story on %s of %s', async (event, file) => {
  const { ctx, root, server, verify } = await createProject()
  const proof = await captureTestCollectionEligibility(ctx)
  server.watcher.emit('all', event, join(root, file))
  expect(await verify(proof.evidence.get('a'))).toBe(false)
  expect(await verify(proof.evidence.get('b'))).toBe(false)
})

it('revalidates unwatched installed and virtual leaves by content', async () => {
  const { ctx, root, verify } = await createProject()
  let proof = await captureTestCollectionEligibility(ctx)
  virtualData = 'export const preference = "dark"'
  expect(await verify(proof.evidence.get('a'))).toBe(false)
  proof = await captureTestCollectionEligibility(ctx)
  expect(await verify(proof.evidence.get('a'))).toBe(true)
  await writeFile(join(root, 'node_modules/installed/index.js'), 'export const installed = 1234')
  expect(await verify(proof.evidence.get('a'))).toBe(false)
})

it('keeps the current generation and later proofs usable after a cancelled proof', async () => {
  const { ctx, verify } = await createProject()
  const before = captureTestCollectionGeneration(ctx)!
  const controller = new AbortController()
  const cancelled = captureTestCollectionEligibility(ctx, undefined, controller.signal)
  controller.abort()
  await expect(cancelled).rejects.toMatchObject({ code: 'CANCELLED' })
  expect(() => before.assertCurrent()).not.toThrow()
  const proof = await captureTestCollectionEligibility(ctx)
  expect([...proof.evidence.keys()].sort()).toEqual(['a', 'b'])
  expect(await verify(proof.evidence.get('b'))).toBe(true)
})
