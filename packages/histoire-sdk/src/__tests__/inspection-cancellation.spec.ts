import type { HistoireBridgeIdentity } from '@histoire/protocol'
import { HistoireSdkError } from '@histoire/protocol'
import { expect, it } from 'vitest'
import { createEmbedPortPair } from '../../../histoire/src/node/__tests__/utils/embed/transport.js'
import { createBridgePort } from '../transport/port.js'
import { deferred } from './fixtures/session.js'

it('cancels the exact remote inspection when its caller aborts', async () => {
  const ports = createEmbedPortPair()
  const owner: HistoireBridgeIdentity = { protocolVersion: 1, sessionId: 'session', connectionId: 'connection', mountId: 'mount', sourceId: 'book', epoch: 'epoch', revision: 'revision', runtimeId: 'document', target: { storyId: 'story', variantId: 'variant' } }
  const held = deferred<void>()
  const started = deferred<void>()
  let remote: AbortSignal | undefined
  const child = createBridgePort({ port: ports.child as unknown as MessagePort, owner, role: 'primary', child: true, dispatch: async (_request, signal) => {
    remote = signal
    started.resolve()
    await held.promise
    signal.throwIfAborted()
  } })
  const parent = createBridgePort({ port: ports.parent as unknown as MessagePort, owner, role: 'primary' })
  const controller = new AbortController()
  try {
    const pending = parent.request('inspection.variant' as any, { target: owner.target }, { ...owner, signal: controller.signal })
    await started.promise
    controller.abort(new HistoireSdkError('CANCELLED', 'Cancelled'))
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
    await viWaitForAbort()
    expect(remote?.aborted).toBe(true)
    const sent = ports.parent.sent as any[]
    const original = sent.find(item => item.command === 'inspection.variant')
    const cancellation = sent.find(item => item.command === 'inspection.cancel')
    expect(cancellation.payload.requestId).toBe(original.requestId)
    expect(cancellation.target).toEqual(original.target)
  }
  finally {
    held.resolve()
    parent.close()
    child.close()
  }
  async function viWaitForAbort() {
    for (let attempt = 0; attempt < 20 && !remote?.aborted; attempt++) await new Promise(resolve => setTimeout(resolve, 0))
  }
})
