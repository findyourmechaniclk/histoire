import type { HistoireSession } from '@histoire/sdk'
import { describe, expect, it } from 'vitest'
import { createInspectionDispatcher } from '../client/inspection.js'

const owner = { sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'runtime', target: { storyId: 'story', variantId: 'variant' } }
const state = { mode: 'live', owner, observedAt: '2026-10-28T12:00:00.000Z', durationMs: 1, truncated: false, inspection: 'variant', state: { draft: 'unsaved' }, components: [], propsAvailable: false, omittedValues: 0 } as const

/** SDK is the external dependency; dispatcher and protocol validation are real. */
function session(read: (options: any) => Promise<any>) {
  return { inspect: { variant: read, dom: read } } as unknown as Pick<HistoireSession, 'inspect'>
}

describe('browser inspection dispatcher', () => {
  it('reads the exact owner and rejects a caller targeting another document', async () => {
    const requests: unknown[] = []
    const dispatch = createInspectionDispatcher(session(async (options) => {
      requests.push(options)
      return state
    }), owner)
    const signal = new AbortController().signal
    const result = await dispatch({ kind: 'variant', target: owner.target, expectedOwner: owner }, signal)
    expect(result).toEqual(state)
    expect(requests).toEqual([{ target: owner.target, expectedOwner: owner, signal }])
    await expect(dispatch({ kind: 'variant', target: { storyId: 'other', variantId: 'variant' }, expectedOwner: owner }, signal)).rejects.toThrow()
    expect(requests).toHaveLength(1)
  })

  it('routes bounded component and accessibility reads to the exact owner', async () => {
    const calls: string[] = []
    const metadata = { mode: 'live', owner, observedAt: '2026-10-28T12:00:00.000Z', durationMs: 1, truncated: false } as const
    const node = { id: 'node', parentId: null, name: 'Example', framework: 'vue' }
    const sdk = { inspect: {
      components: async () => {
        calls.push('tree')
        return { ...metadata, inspection: 'components', coverage: 'complete', limitations: [], nodes: [node], omittedCount: 0 }
      },
      component: async () => {
        calls.push('detail')
        return { ...metadata, inspection: 'component', coverage: 'complete', limitations: [], node, props: {}, selectors: [], omittedValues: 0 }
      },
      accessibility: async () => {
        calls.push('audit')
        return { ...metadata, inspection: 'accessibility', matched: true, engine: 'axe-core', engineVersion: '4.14.0', violations: [], incomplete: [], passesCount: 0, inapplicableCount: 0, droppedCount: 0 }
      },
    } } as unknown as Pick<HistoireSession, 'inspect'>
    const dispatch = createInspectionDispatcher(sdk, owner)
    const signal = new AbortController().signal
    expect(await dispatch({ kind: 'components', target: owner.target, expectedOwner: owner }, signal)).toMatchObject({ inspection: 'components' })
    expect(await dispatch({ kind: 'component', componentId: 'node', target: owner.target, expectedOwner: owner }, signal)).toMatchObject({ inspection: 'component' })
    expect(await dispatch({ kind: 'accessibility', target: owner.target, expectedOwner: owner }, signal)).toMatchObject({ inspection: 'accessibility' })
    expect(calls).toEqual(['tree', 'detail', 'audit'])
  })

  it('dispatches selector and component highlights to the captured owner', async () => {
    const calls: unknown[] = []
    const sdk = { inspect: { highlightLease: async (options: unknown) => {
      calls.push(options)
      return { owner, observedAt: '2026-10-28T12:00:00.000Z', leaseId: 'lease' }
    } } } as unknown as Pick<HistoireSession, 'inspect'>
    const dispatch = createInspectionDispatcher(sdk, owner)
    const signal = new AbortController().signal
    expect(await dispatch({ kind: 'highlight', target: owner.target, expectedOwner: owner, selector: '#target' }, signal)).toEqual({ owner, observedAt: '2026-10-28T12:00:00.000Z', leaseId: 'lease' })
    expect(await dispatch({ kind: 'highlight', target: owner.target, expectedOwner: owner, componentId: 'component' }, signal)).toEqual({ owner, observedAt: '2026-10-28T12:00:00.000Z', leaseId: 'lease' })
    expect(calls).toEqual([{ target: owner.target, expectedOwner: owner, selector: '#target', signal }, { target: owner.target, expectedOwner: owner, componentId: 'component', signal }])
  })

  it('propagates cancellation to SDK read and rejects late results', async () => {
    let started = () => {}
    let release = () => {}
    const called = new Promise<void>((resolve) => {
      started = resolve
    })
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let seen: AbortSignal | undefined
    const dispatch = createInspectionDispatcher(session(async (options) => {
      seen = options.signal
      started()
      await held
      return state
    }), owner)
    const controller = new AbortController()
    const result = dispatch({ kind: 'variant', target: owner.target, expectedOwner: owner }, controller.signal)
    const rejected = expect(result).rejects.toThrow()
    await called
    controller.abort()
    release()
    await rejected
    expect(seen?.aborted).toBe(true)
  })
})
