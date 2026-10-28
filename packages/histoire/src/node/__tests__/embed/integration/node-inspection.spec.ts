import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getProjectServices } from 'histoire/dist/node/api/internal.js'
import { createHistoireProject } from 'histoire/node'
import { describe, expect, it } from 'vitest'
import { createMcpInspectionProject } from '../../utils/mcp/inspection-project.js'

describe('public Node isolated inspection', () => {
  it('reads fresh state, DOM, ARIA and diagnostics from the selected source', async () => {
    const fixture = await createMcpInspectionProject()
    let project: Awaited<ReturnType<typeof createHistoireProject>> | undefined
    try {
      const config = join(fixture.root, 'custom config.ts')
      await writeFile(config, (await readFile(config, 'utf8')).replace('build:{target:\'node\'}', 'build:{target:\'static\'}'))
      const story = join(fixture.root, 'Deterministic.story.vue')
      await writeFile(story, (await readFile(story, 'utf8'))
        .replace('<script setup lang="ts">', '<script setup lang="ts">\nimport { useHistoireGlobals } from \'@histoire/shared\'\nconst globals = useHistoireGlobals()')
        .replace('<section id="inspection-root">', '<section id="inspection-root"><p>{{ globals.theme }}</p>'))
      project = await createHistoireProject({ root: fixture.root, configFile: 'custom config.ts' })
      const dev = await project.startDev({ host: '127.0.0.1', port: 0 })
      await dev.ready
      const target = { source: 'dev' as const, storyId: 'deterministic', variantId: 'normal' }
      const variant = await project.inspect.variant(target)
      expect(variant).toMatchObject({ mode: 'isolated', inspection: 'variant', state: { count: 3, nested: { enabled: true } } })
      expect(variant.state).not.toHaveProperty('computed')
      expect(variant.source).toMatchObject({ sourceId: expect.any(String), epoch: expect.any(String), revision: expect.any(String) })
      const dom = await project.inspect.dom({ ...target, selector: '#inspection-root', maxNodes: 1 })
      expect(dom).toMatchObject({ mode: 'isolated', inspection: 'dom', matched: true, truncated: true, nodes: [{ tag: 'section' }] })
      const defaults = await project.inspect.dom({ ...target, selector: undefined, width: undefined })
      expect(defaults).toMatchObject({ mode: 'isolated', viewport: { width: 1280, height: 800 }, matched: true })
      const aria = await project.inspect.aria({ ...target, selector: '#inspection-root' })
      expect(aria.snapshot).toContain('button "Save"')
      const diagnostics = await project.inspect.diagnostics(target)
      expect(diagnostics.entries).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'console', message: 'inspection fixture warning' })]))
      expect(JSON.stringify(diagnostics)).not.toContain('token=hidden')
      await expect(project.inspect.dom({ ...target, selector: '[' })).rejects.toMatchObject({ code: 'INVALID_SELECTOR' })
      await expect(project.inspect.variant({ ...target, expectedRevision: 'outdated' })).rejects.toMatchObject({ code: 'STALE_REVISION' })
      const execution = getProjectServices(project).dev!.execution
      const release = Promise.withResolvers<void>()
      const blocker = execution.enqueue({ run: () => release.promise })
      try {
        await expect(project.inspect.variant({ ...target, signal: {} as AbortSignal })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
        expect(execution.pendingCount).toBe(0)
        const cancellation = new AbortController()
        const queued = project.inspect.variant({ ...target, signal: cancellation.signal })
        expect(execution.pendingCount).toBe(1)
        cancellation.abort()
        await expect(queued).rejects.toMatchObject({ code: 'CANCELLED' })
        expect(execution.pendingCount).toBe(0)
        const shadowed = new AbortController()
        Object.defineProperties(shadowed.signal, {
          addEventListener: { value: () => { throw new Error('shadowed add') } },
          removeEventListener: { value: () => { throw new Error('shadowed remove') } },
        })
        const shadowedResult = project.inspect.variant({ ...target, signal: shadowed.signal })
        const cancelledShadowed = expect(shadowedResult).rejects.toMatchObject({ code: 'CANCELLED' })
        shadowed.abort()
        await cancelledShadowed
        expect(execution.pendingCount).toBe(0)
      }
      finally {
        release.resolve()
        await blocker.result
      }
      const holdSettings = Promise.withResolvers<void>()
      const busySettings = execution.enqueue({ run: () => holdSettings.promise })
      const globals = { theme: 'before' }
      const copiedSettings = project.inspect.dom({ ...target, globals, selector: '#inspection-root' })
      globals.theme = 'after'
      try {
        holdSettings.resolve()
        await busySettings.result
        const output = await copiedSettings
        expect(output.nodes.map(node => node.text)).toContain('before')
        expect(output.nodes.map(node => node.text)).not.toContain('after')
      }
      finally { holdSettings.resolve() }
      const runningCancellation = new AbortController()
      const running = project.inspect.diagnostics({ ...target, observationMs: 2000, signal: runningCancellation.signal })
      await expect.poll(() => execution.pendingCount).toBe(0)
      runningCancellation.abort()
      await expect(running).rejects.toMatchObject({ code: 'CANCELLED' })
      await expect(project.inspect.variant(target)).resolves.toMatchObject({ state: { count: 3 } })
      await expect(project.inspect.variant({ ...target, source: 'preview' })).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })

      const hold = Promise.withResolvers<void>()
      const busy = execution.enqueue({ run: () => hold.promise })
      const stale = project.inspect.variant(target)
      const staleResult = expect(stale).rejects.toMatchObject({ code: 'RUNTIME_CHANGED' })
      try {
        await appendFile(join(fixture.root, 'Deterministic.story.vue'), '\n<!-- source revision -->\n')
        await expect.poll(() => getProjectServices(project).dev?.catalog?.current?.revision).not.toBe(variant.source.revision)
      }
      finally {
        hold.resolve()
        await busy.result
      }
      await staleResult
      const updated = await project.inspect.variant(target)
      expect(updated.source.revision).not.toBe(variant.source.revision)
      expect(updated.state).toMatchObject({ count: 3 })
      await dev.close()
      await project.build()
      const built = await project.preview({ host: '127.0.0.1', port: 0 })
      await built.ready
      const isolatedBuilt = await project.inspect.variant({ ...target, source: 'preview' })
      expect(isolatedBuilt).toMatchObject({ mode: 'isolated', state: { count: 3 } })
      expect(isolatedBuilt.source.epoch).not.toBe(updated.source.epoch)
      await expect(project.inspect.variant({ ...target, source: 'preview', expectedRevision: updated.source.revision })).rejects.toMatchObject({ code: 'STALE_REVISION' })
      await expect(project.inspect.variant(target)).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    }
    finally {
      await project?.close()
      await fixture.close()
    }
  }, 120_000)
})
