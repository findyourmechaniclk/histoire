import type { HistoireRequestCapture } from '@histoire/sdk/internal'
import { COLLECT_TESTS, RUN_TESTS, RUNTIME_REQUEST } from '@histoire/protocol'
import { expect, it, vi } from 'vitest'
import { createRuntimeRequests } from '../../../../../histoire-app/src/embed/adapters/runtime-requests.js'

it('preserves null runtime channel acknowledgement instead of fabricating test definitions', async () => {
  const post = vi.fn()
  const requests = createRuntimeRequests(post, 1000)
  const capture: HistoireRequestCapture = { sessionId: 'session', connectionId: 'connection', sourceId: 'source', epoch: 'epoch', revision: 'revision', mountId: 'mount', runtimeId: 'document', target: { storyId: 'book', variantId: 'one' }, signal: new AbortController().signal }
  try {
    const pending = requests.request(RUNTIME_REQUEST, { command: 'channel.post', payload: { name: 'factory', type: 'application', data: null } }, capture)
    let settled = false
    void pending.then(() => {
      settled = true
    }, () => { settled = true })
    const requestId = post.mock.calls[0][0].requestId
    // Runtime replies carry the rendered tuple; another actor cannot settle it.
    requests.receive({ requestId, result: null })
    requests.receive({ requestId, storyId: 'book', variantId: 'other', result: null })
    requests.receive({ requestId, storyId: 'other', variantId: 'one', result: null })
    await Promise.resolve()
    expect(settled).toBe(false)
    requests.receive({ requestId, storyId: 'book', variantId: 'one', result: null })
    await expect(pending).resolves.toBeNull()
  }
  finally { requests.invalidate() }
})

it('accepts attributed collection and test results only for their captured target', async () => {
  const post = vi.fn()
  const requests = createRuntimeRequests(post, 1000)
  const capture: HistoireRequestCapture = { sessionId: 'session', connectionId: 'connection', sourceId: 'source', epoch: 'epoch', revision: 'revision', mountId: 'mount', runtimeId: 'document', target: { storyId: 'book', variantId: 'one' }, signal: new AbortController().signal }
  try {
    const collection = requests.request(COLLECT_TESTS, { command: 'tests.collect' }, capture)
    const collectionId = post.mock.calls[0][0].requestId
    let settled = false
    void collection.then(() => {
      settled = true
    }, () => { settled = true })
    requests.receive({ requestId: collectionId, storyId: 'book', variantId: 'other', definitions: [{ id: 'wrong' }] })
    await Promise.resolve()
    expect(settled).toBe(false)
    requests.receive({ requestId: collectionId, storyId: 'book', variantId: 'one', definitions: [{ id: 'right' }] })
    await expect(collection).resolves.toEqual({ definitions: [{ id: 'right' }], error: null })
    const execution = requests.request(RUN_TESTS, { command: 'tests.run' }, capture)
    const runId = post.mock.calls[1][0].runId
    const summary = { passed: 1, failed: 0 }
    requests.receive({ runId, storyId: 'book', variantId: 'other', summary: { passed: 0, failed: 1 } })
    requests.receive({ runId, storyId: 'book', variantId: 'one', summary })
    await expect(execution).resolves.toEqual({ passed: 1, failed: 0 })
  }
  finally { requests.invalidate() }
})
