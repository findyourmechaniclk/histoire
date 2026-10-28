import type { HistoireSettings } from '@histoire/protocol'
import type { PreviewSessionOptions } from '../runtime/browser/session.js'
import type { ProjectServices } from './internal.js'
import type { HistoireCaptureOptions } from './types.js'
import { HistoireSdkError, validateSettingsPatch } from '@histoire/protocol'
import { CAPTURE_LIMITS } from '../runtime/browser/limits.js'
import { lookupTarget, validId } from '../runtime/catalog/lookup.js'
import { getContextScreenshotSetup } from '../runtime/registry.js'
import { getDevPreviewHost } from '../vite/mcp-preview-html.js'

/** Validates strict public inputs before reserving lane or acquiring browser. */
function captureInput(options: HistoireCaptureOptions) {
  if (!options || !validId(options.storyId) || !validId(options.variantId)) throw new HistoireSdkError('INVALID_ARGUMENT', 'Exact storyId and variantId required')
  const width = options.width ?? 480
  const height = options.height ?? 320
  const deviceScaleFactor = options.deviceScaleFactor ?? 1
  if (!Number.isInteger(width) || width < CAPTURE_LIMITS.minWidth || width > CAPTURE_LIMITS.width
    || !Number.isInteger(height) || height < CAPTURE_LIMITS.minHeight || height > CAPTURE_LIMITS.height
    || !Number.isInteger(deviceScaleFactor) || deviceScaleFactor < 1 || deviceScaleFactor > CAPTURE_LIMITS.deviceScaleFactor) {
    throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid capture viewport or device scale')
  }
  validateSettingsPatch({ ...(options.globals === undefined ? {} : { globals: options.globals }), ...(options.textDirection === undefined ? {} : { textDirection: options.textDirection }), ...(options.colorScheme === undefined ? {} : { colorScheme: options.colorScheme }) })
  if (options.signal?.aborted) throw new HistoireSdkError('CANCELLED', 'Capture cancelled')
  return { width, height, deviceScaleFactor }
}

/** Select one source and retain its generation and execution lane. */
export function acquireCaptureSource(services: ProjectServices, options: HistoireCaptureOptions, selected: 'dev' | 'preview') {
  const dimensions = captureInput(options)
  let session: PreviewSessionOptions
  let execution = services.execution
  let defaults: Pick<HistoireSettings, 'globals' | 'textDirection' | 'colorScheme' | 'backgroundColor'>
  let isActive: () => boolean
  let identity: { sourceId: string, epoch: string, revision: string }
  const preview = selected === 'preview' ? services.preview : undefined
  if (selected === 'preview') {
    if (!preview) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'No ready built source')
    const source = preview.current
    if (preview.handle.status !== 'ready' || !source?.isActive()) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'Chosen preview capture source unavailable')
    source.snapshot.getTarget(options.storyId, options.variantId)
    identity = { sourceId: source.snapshot.buildId, epoch: source.epoch, revision: source.snapshot.buildId }
    defaults = source.snapshot.defaults
    execution = source.execution
    isActive = source.isActive
    session = { root: services.root, host: source.registry, setupOwner: source.setupOwner, target: { origin: source.origin, epoch: source.epoch, storyId: options.storyId, variantId: options.variantId, ...dimensions, textDirection: defaults.textDirection, backgroundColor: defaults.backgroundColor, isActive } }
  }
  else {
    const dev = services.dev
    const source = dev?.controller.current
    const snapshot = dev?.catalog?.current
    if (dev?.handle.status !== 'ready' || !source?.isActive() || !snapshot || dev.catalog.updating) throw new HistoireSdkError('CAPABILITY_UNAVAILABLE', 'No ready capture source')
    lookupTarget(snapshot, options.storyId, options.variantId)
    identity = { sourceId: snapshot.projectId, epoch: source.epoch, revision: snapshot.revision }
    const config = source.context.config
    defaults = { globals: config.preview?.globals ?? {}, textDirection: config.preview?.textDirection ?? 'ltr', colorScheme: config.theme.defaultColorScheme, backgroundColor: config.backgroundPresets?.[0]?.color ?? 'transparent' }
    execution = dev.execution
    // Retained metadata is readable while collection runs, never executable.
    isActive = () => source.isActive() && dev.catalog?.current === snapshot && !dev.catalog.updating
    session = { root: services.root, host: getDevPreviewHost(source.server), setupOwner: getContextScreenshotSetup(source.context, source.isActive), target: { origin: new URL(dev.handle.url).origin, epoch: source.epoch, storyId: options.storyId, variantId: options.variantId, ...dimensions, textDirection: defaults.textDirection, backgroundColor: defaults.backgroundColor, isActive } }
  }
  const colorScheme = options.colorScheme ?? defaults.colorScheme
  session.target = { ...session.target, textDirection: options.textDirection ?? defaults.textDirection, colorScheme: colorScheme === 'auto' ? undefined : colorScheme, globals: { ...(options.globals ?? defaults.globals) }, backgroundColor: defaults.backgroundColor }
  return { session, execution, isActive, identity }
}
