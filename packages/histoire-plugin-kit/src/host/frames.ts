import type { PluginChannel } from '../types/channel.js'
import type { Disposer } from '../types/common.js'
import type { FrameRef, WorkbenchContext } from '../types/context.js'
import type { PluginFrameRef, WorkbenchPluginApi } from '../types/plugin.js'

/**
 * Key under which a host exposes its {@link PluginFrameService} on the root context it passes to
 * `createExtensionHost`. `Symbol.for` lets separately bundled hosts share it without an import.
 */
export const PLUGIN_FRAMES_SERVICE = Symbol.for('@histoire/plugin-kit/frames')

/** Host-level frame messaging, shared by every plugin of one extension host. */
export interface PluginFrameService {
  /** Frames where `pluginId`'s frame module is attached. */
  list: (pluginId: string) => ReadonlyArray<PluginFrameRef>
  /**
   * Channel bound to the exact actor of `frame` (its `actorId` when given).
   * @param signal Plugin lifetime; aborting it releases the channel's listeners.
   */
  open: (pluginId: string, frame: FrameRef, signal: AbortSignal) => PluginChannel
  /** Observes frame-side failures attributed to `pluginId`. */
  onError: (pluginId: string, listener: (error: Error) => void) => Disposer
  /** Observes actor attach and detach of any plugin; `api.frames.subscribe` narrows it. */
  subscribe: (listener: () => void) => Disposer
}

/** Coded failure without a runtime protocol dependency. */
function failure(code: string, message: string): Error {
  return Object.assign(new Error(`[histoire plugin] ${message}`), { code })
}

/**
 * Identity of a frame list: changes only when an actor of the plugin attaches or detaches.
 * @param frames Frames listed for one plugin.
 */
function listKey(frames: ReadonlyArray<PluginFrameRef>): string {
  return JSON.stringify(frames.map(frame => [frame.key, frame.actorId]))
}

/**
 * `api.frames` of one plugin. Channels and failure subscriptions belong to the plugin and are
 * released with it; hosts without frame messaging report the service unavailable.
 * @param options Plugin identity, root context and ownership hooks.
 * @param options.id Plugin id.
 * @param options.context Root context, possibly carrying the frame service.
 * @param options.signal Plugin scope signal.
 * @param options.reportError Records a diagnostic attributed to the plugin.
 * @param options.track Ties a resource to the plugin lifetime.
 */
export function createPluginFrames(options: { id: string, context: WorkbenchContext, signal: AbortSignal, reportError: (error: unknown) => void, track: (release: () => void) => Disposer }): WorkbenchPluginApi['frames'] {
  const service = Reflect.get(options.context, PLUGIN_FRAMES_SERVICE) as PluginFrameService | undefined
  if (service && !options.signal.aborted) options.track(service.onError(options.id, options.reportError))
  const list = () => service && !options.signal.aborted ? service.list(options.id) : []
  return {
    list,
    subscribe(listener) {
      if (!service || options.signal.aborted) return () => {}
      // Host notifications cover every plugin's actors: forward only changes of this plugin's list.
      let last = listKey(list())
      return options.track(service.subscribe(() => {
        const next = listKey(list())
        if (next === last) return
        last = next
        try {
          listener()
        }
        catch (error) {
          options.reportError(error)
        }
      }))
    },
    open(frame) {
      if (!service) throw failure('CAPABILITY_UNAVAILABLE', 'frame channels are unavailable in this host')
      if (options.signal.aborted) throw failure('RUNTIME_CHANGED', `plugin "${options.id}" was disposed`)
      return service.open(options.id, frame, options.signal)
    },
  }
}
