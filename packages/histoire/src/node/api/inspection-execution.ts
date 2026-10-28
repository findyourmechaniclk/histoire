import type { ExecutionHandle } from '../runtime/execution-types.js'
import { HistoireSdkError } from '@histoire/protocol'
import { hasUnconfirmedCleanup } from '../runtime/cleanup.js'
import { toSdkExecutionError } from './execution.js'

/** Join owned cleanup and reject observations from a retired source. */
export async function awaitInspectionExecution<T>(handle: ExecutionHandle<T>, isActive: () => boolean, signal?: AbortSignal): Promise<T> {
  const cancel = () => handle.cancel()
  if (signal) {
    let subscribed = false
    try {
      EventTarget.prototype.addEventListener.call(signal, 'abort', cancel, { once: true })
      subscribed = true
      if (Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!.call(signal)) cancel()
    }
    catch {
      // A subscription failure must not leave already-admitted work running.
      if (subscribed) EventTarget.prototype.removeEventListener.call(signal, 'abort', cancel)
      handle.cancel()
      try {
        await handle.result
      }
      catch (error) {
        if (hasUnconfirmedCleanup(error)) throw error
      }
      throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid inspection signal')
    }
  }
  let result: T
  try {
    result = await handle.result
  }
  catch (cause) {
    const error = toSdkExecutionError(cause)
    // Never hide unsafe cleanup or an explicit caller cancellation behind stale ownership.
    if (hasUnconfirmedCleanup(error) || (error instanceof HistoireSdkError && error.code === 'CANCELLED')) throw error
    if (!isActive()) throw new HistoireSdkError('RUNTIME_CHANGED', 'Inspection source changed')
    throw error
  }
  finally {
    if (signal) EventTarget.prototype.removeEventListener.call(signal, 'abort', cancel)
  }
  if (!isActive()) throw new HistoireSdkError('RUNTIME_CHANGED', 'Inspection source changed')
  return result
}
