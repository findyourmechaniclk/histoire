import type { ProjectServices } from './internal.js'
import type { HistoireCaptureOptions, HistoireCaptureResult } from './types.js'
import { HistoireSdkError } from '@histoire/protocol'
import { createScreenshotTask } from '../runtime/browser/screenshot.js'
import { acquireCaptureSource } from './capture-source.js'
import { awaitSdkExecution, toSdkExecutionError } from './execution.js'

/** Chooses one source synchronously; selected preview never falls back to live dev. */
export async function captureProjectScreenshot(services: ProjectServices, options: HistoireCaptureOptions): Promise<HistoireCaptureResult> {
  try {
    const { session, execution, isActive } = acquireCaptureSource(services, options, services.preview ? 'preview' : 'dev')
    const task = createScreenshotTask(session)
    const result = await awaitSdkExecution(execution.enqueue({ ...task, validate() {
      if (!isActive()) throw new HistoireSdkError('RUNTIME_CHANGED', 'Capture source changed')
    } }), options.signal)
    if (!isActive()) throw new HistoireSdkError('RUNTIME_CHANGED', 'Capture source changed')
    return { png: new Uint8Array(result.artifact), mimeType: 'image/png', width: result.result.width, height: result.result.height, sha256: result.result.sha256 }
  }
  catch (error) { throw toSdkExecutionError(error) }
}
