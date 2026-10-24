import { previewFrameActors } from './frame-actors.js'
import { previewFramePluginChannels } from './frame-plugin-channels.js'

/**
 * Emits the frame-plugin section of the preview runtime: manifest loading,
 * definition validation and the per-plugin attachment of one actor (context,
 * abort signal, cleanups, channel), the plugin channels from
 * {@link previewFramePluginChannels} and the actor registry from {@link previewFrameActors}.
 *
 * Needs from earlier sections: `initialSelection` and `importFramePluginManifest`
 * (preamble), `previewDocumentId` and `postToParent` (host messaging),
 * `isInteractiveFramePurpose`, `measureWireValue`, `HOST_CHANNEL_MESSAGE`, `nextTick` (imports).
 */
export function previewFramePlugins() {
  return `${previewFramePluginLoading()}

${previewFramePluginAttachment()}

${previewFramePluginChannels()}

${previewFrameActors()}`
}

/** Emits eligibility, manifest loading, validation and failure reporting. */
function previewFramePluginLoading() {
  return `// Frame plugins exist only in documents a person interacts with. Test workers,
// automation captures and controls replicas never import the manifest, so no
// frame entry module is ever evaluated there.
const framePluginsEnabled = isInteractiveFramePurpose(initialSelection.purpose)
let framePluginsPromise = null

/**
 * Logs a frame plugin failure attributed to its plugin and, when it belongs to an actor, posts a
 * \`histoire:error\` notice so the host records a diagnostic. The story is never affected: its
 * readiness was already published when hooks run.
 * @param origin \`{ actorId, target }\` of the actor the failure happened for.
 */
function reportFramePluginError(pluginId, phase, error, origin) {
  console.error((pluginId ? '[histoire plugin "' + pluginId + '"]' : '[histoire plugin]') + ' frame ' + phase + ' failed:', error)
  if (!pluginId || !origin) return
  const message = String(error?.message ?? error).slice(0, 2000)
  postFramePluginBody(pluginId, origin.actorId, origin.target, 'histoire:error', { phase, message })
}

/**
 * Loads every frame plugin once per document, in manifest (config) order. A
 * failing manifest import or plugin module is reported once and skipped.
 * @param origin Actor that triggered loading; load failures are attributed to it.
 */
function loadFramePlugins(origin) {
  if (!framePluginsEnabled) return Promise.resolve([])
  if (!framePluginsPromise) {
    framePluginsPromise = (async () => {
      let manifest
      try {
        manifest = await importFramePluginManifest()
      }
      catch (error) {
        reportFramePluginError(null, 'manifest import', error)
        return []
      }
      const plugins = await Promise.all((manifest.framePlugins ?? []).map(entry => loadFramePlugin(entry, origin)))
      return plugins.filter(Boolean)
    })()
  }
  return framePluginsPromise
}

/** Imports and validates one manifest entry; null when it cannot be used. */
async function loadFramePlugin(entry, origin) {
  try {
    const definition = (await entry.load())?.default
    assertFramePluginDefinition(definition, entry.id)
    return { id: entry.id, options: entry.options, attach: definition.attach }
  }
  catch (error) {
    reportFramePluginError(entry.id, 'load', error, origin)
    return null
  }
}

/**
 * Same checks as \`defineFramePlugin\` (@histoire/plugin-kit/frame), repeated
 * here because Histoire does not depend on plugin-kit and an entry may export
 * a plain object. The definition id must match its descriptor.
 */
function assertFramePluginDefinition(definition, id) {
  if (typeof definition !== 'object' || definition === null) throw new TypeError('frame entry must default-export a frame plugin definition')
  if (definition.id !== id) throw new TypeError('definition id ' + JSON.stringify(definition.id) + ' does not match descriptor id')
  if (definition.apiVersion !== 1) throw new TypeError('unsupported apiVersion ' + JSON.stringify(definition.apiVersion) + '; expected 1')
  if (typeof definition.attach !== 'function') throw new TypeError('missing \`attach\` function')
}`
}

/** Emits the attachment of one plugin to one actor: context, signal and cleanups. */
function previewFramePluginAttachment() {
  return `/**
 * Readonly state view of the actor's variant. \`value\` reads the same
 * serialized projection captured for VARIANT_READY, frozen so plugins cannot
 * write through it; subscriptions stop with the attachment signal.
 * @param source \`{ get, watch }\` provided by the app for the ready variant.
 */
function createReadonlyFrameState(source, signal) {
  return Object.freeze({
    get value() { return Object.freeze(source.get()) },
    subscribe(listener) {
      if (signal.aborted) return () => {}
      const stop = source.watch(() => {
        if (!signal.aborted) listener()
      })
      const dispose = () => {
        stop()
        signal.removeEventListener('abort', dispose)
      }
      signal.addEventListener('abort', dispose)
      return dispose
    },
  })
}

/**
 * Starts one plugin on one actor. The attachment owns an AbortController, the
 * cleanup list and its channel listeners; anything registered or resolved after
 * it stopped (late async attach work) runs immediately instead of leaking. The
 * host learns about the actor only once \`attach\` settled, so its first message
 * finds the plugin's listeners in place.
 * @param scope \`{ target, element, state }\` of the ready actor.
 */
function startFramePluginAttachment(plugin, actor, scope) {
  const controller = new AbortController()
  const target = Object.freeze({ storyId: scope.target.storyId, variantId: scope.target.variantId })
  const attachment = { pluginId: plugin.id, actorId: actor.id, target, controller, cleanups: [], listeners: new Set(), announced: false }
  const onCleanup = (callback) => {
    if (typeof callback !== 'function') return
    if (controller.signal.aborted) runFramePluginCleanup(attachment, callback)
    else attachment.cleanups.push(callback)
  }
  const context = Object.freeze({
    actorId: actor.id,
    documentId: previewDocumentId,
    target,
    element: scope.element,
    signal: controller.signal,
    state: createReadonlyFrameState(scope.state, controller.signal),
    options: plugin.options,
    channel: createFramePluginChannel(attachment),
    onCleanup,
  })
  new Promise(resolve => resolve(plugin.attach(context))).then((disposer) => {
    onCleanup(disposer)
    if (controller.signal.aborted) return
    attachment.announced = true
    postFramePluginBody(plugin.id, actor.id, target, 'histoire:attached', null)
  }, (error) => {
    // Rejections after detach are the plugin reacting to its aborted signal.
    if (controller.signal.aborted) return
    reportFramePluginError(plugin.id, 'attach', error, attachment)
    stopFramePluginAttachment(attachment)
  })
  return attachment
}

/**
 * Detach order: abort the signal and drop channel listeners at once, run cleanups in
 * reverse registration order, then tell the host the actor is gone.
 */
function stopFramePluginAttachment(attachment) {
  if (attachment.controller.signal.aborted) return
  attachment.controller.abort()
  attachment.listeners.clear()
  for (const cleanup of attachment.cleanups.splice(0).reverse()) runFramePluginCleanup(attachment, cleanup)
  if (attachment.announced) postFramePluginBody(attachment.pluginId, attachment.actorId, attachment.target, 'histoire:detached', null)
}

/** One failing cleanup never prevents the others. */
function runFramePluginCleanup(attachment, cleanup) {
  try {
    cleanup()
  }
  catch (error) {
    reportFramePluginError(attachment.pluginId, 'cleanup', error, attachment)
  }
}`
}
