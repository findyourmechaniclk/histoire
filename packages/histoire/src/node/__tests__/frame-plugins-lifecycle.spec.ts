// @vitest-environment jsdom
import type { FramePluginContext } from '../../../../histoire-plugin-kit/src/types/frame.js'
import type { FramePluginManifestEntry } from './utils/preview-runtime-app.js'
import { VARIANT_READY } from '@histoire/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPreviewRuntimeApp } from './utils/preview-runtime-app.js'

type Runtime = ReturnType<typeof createPreviewRuntimeApp>

/** Every runtime a test creates; unmounted after each test. */
const runtimes: Runtime[] = []

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close()
  vi.restoreAllMocks()
})

/** Creates a generated runtime document closed after the test. */
function createRuntime(options: Parameters<typeof createPreviewRuntimeApp>[0] = {}) {
  const runtime = createPreviewRuntimeApp(options)
  runtimes.push(runtime)
  return runtime
}

/** Lets readiness frames, the manifest import and async attach hooks settle. */
async function settle(runtime: Runtime) {
  await runtime.frames()
  await new Promise(resolve => setTimeout(resolve))
}

/**
 * Delivers a selection and lets the runtime finish it, readiness frames included.
 * @param runtime Runtime document receiving the selection.
 * @param variantId Selected variant.
 * @param version Selection version.
 */
async function select(runtime: Runtime, variantId: string, version: number) {
  const pending = runtime.select(variantId, version)
  await settle(runtime)
  await pending
  await settle(runtime)
}

/**
 * Manifest entry whose frame module records every lifecycle step of the plugin.
 * @param id Plugin id (descriptor and definition).
 * @param log Receives `attach:<actor>`, `cleanup:<actor>` and similar steps.
 * @param attach Extra attach behavior.
 */
function recordingPlugin(id: string, log: string[], attach?: (frame: FramePluginContext) => unknown): FramePluginManifestEntry {
  return {
    id,
    apiVersion: 1,
    options: { label: id },
    load: async () => ({ default: { id, apiVersion: 1, attach(frame: FramePluginContext) {
      log.push(`${id}:attach:${frame.target.variantId}`)
      frame.onCleanup(() => log.push(`${id}:cleanup:${frame.target.variantId}:${frame.element.textContent}`))
      frame.signal.addEventListener('abort', () => log.push(`${id}:abort`))
      return attach?.(frame)
    } } }),
  }
}

/** Plugin collecting every attach context it receives. */
function contextPlugin(contexts: FramePluginContext[]): FramePluginManifestEntry {
  return recordingPlugin('probe', [], (frame) => {
    contexts.push(frame)
  })
}

describe('frame plugin lifecycle', () => {
  it('attaches once per rendered actor after readiness and mints a new actor for every remount', async () => {
    const contexts: FramePluginContext[] = []
    const runtime = createRuntime({ framePlugins: [contextPlugin(contexts)] })
    await settle(runtime)
    expect(runtime.messages.some(message => message.type === VARIANT_READY && message.variantId === 'first')).toBe(true)
    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({ documentId: 'document', target: { storyId: 'story', variantId: 'first' }, options: { label: 'probe' } })
    expect(contexts[0].element.textContent).toBe('first')

    // Restored selection re-acknowledges the same rendered actor: no second attach.
    await select(runtime, 'first', 1)
    expect(contexts).toHaveLength(1)

    await select(runtime, 'second', 2)
    await select(runtime, 'first', 3)
    expect(contexts.map(frame => frame.target.variantId)).toEqual(['first', 'second', 'first'])
    expect(new Set(contexts.map(frame => frame.actorId)).size).toBe(3)
    expect(runtime.framePluginManifestImports).toBe(1)
  })

  it('detaches on selection change before the renderer unmounts, aborting then cleaning up in reverse', async () => {
    const log: string[] = []
    const runtime = createRuntime({ framePlugins: [recordingPlugin('one', log), recordingPlugin('two', log)] })
    await settle(runtime)
    expect(log).toEqual(['one:attach:first', 'two:attach:first'])
    log.length = 0

    await runtime.select('second', 1)
    // Cleanups still see the rendered variant; plugins detach in reverse order.
    expect(log.slice(0, 4)).toEqual(['two:abort', 'two:cleanup:first:first', 'one:abort', 'one:cleanup:first:first'])
  })

  it('detaches on page hide and HMR story change, and disposes late async attach work', async () => {
    const log: string[] = []
    let finishAttach!: () => void
    const late = vi.fn()
    const slow = recordingPlugin('slow', log, frame => new Promise<() => void>((resolve) => {
      finishAttach = () => {
        frame.onCleanup(() => log.push('late-cleanup'))
        resolve(late)
      }
    }))
    const contexts: FramePluginContext[] = []
    const runtime = createRuntime({ framePlugins: [slow, contextPlugin(contexts)] })
    await settle(runtime)
    const [initial] = contexts

    // A change of another story keeps this actor.
    runtime.storyChanged('other-story')
    expect(initial.signal.aborted).toBe(false)

    runtime.storyChanged('story')
    expect(initial.signal.aborted).toBe(true)
    finishAttach()
    await settle(runtime)
    expect(late).toHaveBeenCalledOnce()
    expect(log).toContain('late-cleanup')
    // The renderer survives a hot update without a new readiness signal: a new actor re-attaches.
    expect(contexts).toHaveLength(2)
    expect(contexts[1].actorId).not.toBe(initial.actorId)

    runtime.pagehide()
    expect(contexts[1].signal.aborted).toBe(true)
  })

  it('keeps the story ready and other plugins attached when a plugin fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log: string[] = []
    const contexts: FramePluginContext[] = []
    const runtime = createRuntime({ framePlugins: [
      recordingPlugin('throws', log, () => {
        throw new Error('attach exploded')
      }),
      recordingPlugin('rejects', log, async () => {
        throw new Error('async attach exploded')
      }),
      { id: 'invalid', apiVersion: 1, load: async () => ({ default: { id: 'other', apiVersion: 1, attach() {} } }) },
      { id: 'missing', apiVersion: 1, load: async () => {
        throw new Error('module not found')
      } },
      contextPlugin(contexts),
    ] })
    await settle(runtime)

    expect(runtime.messages.filter(message => message.type === VARIANT_READY)).toHaveLength(1)
    expect(contexts).toHaveLength(1)
    expect(contexts[0].signal.aborted).toBe(false)
    // A failed attach runs the cleanups it registered before failing.
    expect(log).toEqual(expect.arrayContaining(['throws:abort', 'throws:cleanup:first:first', 'rejects:abort']))
    const reported = error.mock.calls.map(call => String(call[0]))
    for (const id of ['throws', 'rejects', 'invalid', 'missing']) {
      expect(reported.some(message => message.includes(`"${id}"`))).toBe(true)
    }

    // Selection keeps working after the failures.
    await select(runtime, 'second', 1)
    expect(runtime.messages.filter(message => message.type === VARIANT_READY).at(-1)).toMatchObject({ variantId: 'second' })
    expect(contexts).toHaveLength(2)
  })

  it('exposes a readonly state view', async () => {
    const contexts: FramePluginContext[] = []
    const runtime = createRuntime({ framePlugins: [contextPlugin(contexts)] })
    runtime.file.story.variants[0].state = { count: 1 }
    await settle(runtime)
    const [frame] = contexts
    const listener = vi.fn()
    frame.state.subscribe(listener)
    expect(frame.state.value).toEqual({ count: 1 })
    expect(() => {
      (frame.state.value as { count: number }).count = 5
    }).toThrow()

    ;(runtime.file.story.variants[0].state as { count: number }).count = 2
    await settle(runtime)
    expect(listener).toHaveBeenCalled()
    expect(frame.state.value).toEqual({ count: 2 })
  })

  it.each(['test-worker', 'automation', 'controls'] as const)('never imports frame plugins in %s documents', async (purpose) => {
    const contexts: FramePluginContext[] = []
    const runtime = createRuntime({ purpose, framePlugins: [contextPlugin(contexts)] })
    await settle(runtime)
    expect(runtime.messages.some(message => message.type === VARIANT_READY)).toBe(true)
    expect(runtime.framePluginManifestImports).toBe(0)
    expect(contexts).toEqual([])
  })

  it('gives Matrix cells of the same variant distinct actors', async () => {
    const contexts: FramePluginContext[] = []
    const cells = [
      createRuntime({ matrix: true, documentId: 'cell-a', framePlugins: [contextPlugin(contexts)] }),
      createRuntime({ matrix: true, documentId: 'cell-b', framePlugins: [contextPlugin(contexts)] }),
    ]
    for (const cell of cells) await settle(cell)
    expect(contexts.map(frame => frame.documentId)).toEqual(['cell-a', 'cell-b'])
    expect(contexts[0].actorId).not.toBe(contexts[1].actorId)
  })
})
