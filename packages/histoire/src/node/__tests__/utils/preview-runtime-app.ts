import type { HistoireFramePurpose } from '@histoire/shared'
import * as protocol from '@histoire/protocol'
import { createVariantStateSyncGuards, getVariantStateKey, isInteractiveFramePurpose } from '@histoire/shared'
import * as vue from 'vue'
import { previewApp } from '../../virtual/preview-runtime/app.js'
import { previewComponents } from '../../virtual/preview-runtime/components.js'
import { previewFramePlugins } from '../../virtual/preview-runtime/frame-plugins.js'
import { previewHostMessaging } from '../../virtual/preview-runtime/host-messaging.js'

/** Entry of the `virtual:$histoire-frame-plugins` manifest, as the runtime imports it. */
export interface FramePluginManifestEntry {
  /** Descriptor id. */
  id: string
  /** Descriptor contract version. */
  apiVersion: number
  /** Browser-visible descriptor options. */
  options?: unknown
  /** Lazy import of the frame entry module. */
  load: () => Promise<{ default: unknown }>
}

/** Execute actual generated Vue app, rendering framework actors with controlled frame timing. */
export function createPreviewRuntimeApp(options: {
  storyId?: string
  variantId?: string
  documentId?: string
  /** Receives messages posted by the generated runtime. */
  onMessage?: (message: Record<string, any>) => void
  /** Document purpose parsed from the frame URL; defaults to `interactive`. */
  purpose?: HistoireFramePurpose
  /** Marks the document as an isolated Matrix cell. */
  matrix?: boolean
  /** Frame plugin manifest served to the runtime; its import is counted. */
  framePlugins?: FramePluginManifestEntry[]
} = {}) {
  const messages: Record<string, any>[] = []
  const callbacks: FrameRequestCallback[] = []
  const actorReady: (() => void)[] = []
  let paused = false
  let listener: (event: unknown) => Promise<void>
  const pagehideListeners: (() => void)[] = []
  let framePluginManifestImports = 0
  const host = { postMessage: (message: Record<string, any>) => {
    messages.push(message)
    options.onMessage?.(message)
  } }
  const storyId = options.storyId ?? 'story'
  const variantId = options.variantId ?? 'first'
  const file = vue.reactive({ story: { id: storyId, variants: [{ id: variantId, state: {} }, { id: 'second', state: {} }] } })
  const container = document.createElement('div')
  document.body.append(container)
  const scope: Record<string, any> = {
    ...vue,
    ...protocol,
    createVariantStateSyncGuards,
    getVariantStateKey,
    isInteractiveFramePurpose,
    initialSelection: { storyId, variantId, matrix: options.matrix === true, purpose: options.purpose ?? 'interactive' },
    /** Counts manifest evaluation: the generated runtime's only path to frame plugin modules. */
    async importFramePluginManifest() {
      framePluginManifestImports++
      return { framePlugins: options.framePlugins ?? [] }
    },
    selectionState: {},
    histoireConfig: {},
    window: {
      location: { origin: window.location.origin, search: `?documentId=${encodeURIComponent(options.documentId ?? 'document')}&selectionVersion=0` },
      frameElement: { ownerDocument: { defaultView: host } },
      /** Capture generated runtime dispatch and page-hide teardown. */
      addEventListener(type: string, callback: typeof listener) {
        if (type === 'message') listener = callback
        if (type === 'pagehide') pagehideListeners.push(callback as () => void)
      },
    },
    /** Frame timing separates framework readiness from delayed serialized snapshot publication. */
    requestAnimationFrame(callback: FrameRequestCallback) { return callbacks.push(callback) },
    loadStoryFile: async () => file,
    clearRuntimeTestDefinitions: () => {},
    clearStaleRuntimeReloadGuard: () => {},
    observeRuntimeLayout: () => ({ refresh() {}, close() {} }),
    installRuntimeHostChannels: () => ({ receive() {}, close() {} }),
    installRuntimeEventScope: () => () => {},
    createRuntimeState: (getState: () => object, serialize: (value: object) => object) => ({ capture() {}, get: () => serialize(getState()) }),
    createRuntimeStatePresets: () => ({ restoreSelected() {} }),
    toRawDeep: (value: unknown) => JSON.parse(JSON.stringify(vue.toRaw(value))),
    postVariantStateSnapshot: () => {},
    postVariantStateSnapshotById: () => {},
    GenericMountStory: vue.defineComponent({ render: () => null }),
    GenericRenderStory: vue.defineComponent({
      props: ['variant'],
      emits: ['ready'],
      /** Stand-in framework renderer uses real Vue mount timing and readiness event. */
      setup(props, { emit }) {
        vue.onMounted(() => paused ? actorReady.push(() => emit('ready')) : emit('ready'))
        return () => vue.h('p', props.variant.id)
      },
    }),
  }
  const globals = new Proxy(scope, {
    has: () => true,
    get: (target, key) => key in target ? target[key as string] : (globalThis as any)[key],
  })
  // eslint-disable-next-line no-new-func -- production runtime is generated source.
  const { app, handleFrameStoryChanged } = new Function('scope', `with (scope) { ${previewHostMessaging()}\n${previewFramePlugins()}\n${previewComponents()}\n${previewApp()}\nreturn { app, handleFrameStoryChanged } }`)(globals) as { app: vue.App, handleFrameStoryChanged: (storyId: string) => void }
  app.mount(container)
  /**
   * Delivers one trusted host message (marker and host source added).
   * @param data Message body.
   */
  function receive(data: Record<string, unknown>) {
    return listener!({ source: host, origin: window.location.origin, data: { __histoire: true, ...data } })
  }
  return {
    /** Runtime-owned root supports rendering assertions without consulting global page state. */
    container,
    messages,
    /** Reactive story file the runtime renders; tests mutate variant state through it. */
    file,
    /** Times the frame plugin manifest was imported by this document. */
    get framePluginManifestImports() { return framePluginManifestImports },
    /** Runs the generated page-hide teardown, as on navigation away from the document. */
    pagehide() { for (const callback of pagehideListeners.splice(0)) callback() },
    /**
     * Runs the generated reaction to an HMR `STORY_CHANGED_EVENT`.
     * @param changedStoryId Story whose module changed.
     */
    storyChanged(changedStoryId: string) { handleFrameStoryChanged(changedStoryId) },
    /** Returning cached variant still waits for its newly mounted renderer. */
    pauseRendering() { paused = true },
    /** Framework readiness is independent from delayed snapshot publication. */
    renderReady() { for (const ready of actorReady.splice(0)) ready() },
    /** Allow app initialization and renderer's two-tick snapshot wait to reach next frame. */
    async ticks() {
      for (let index = 0; index < 6; index++) await vue.nextTick()
    },
    /** Advance actual generated snapshot wait without arbitrary timer sleeps. */
    async frames() {
      for (let index = 0; index < 6; index++) {
        await vue.nextTick()
        for (const callback of callbacks.splice(0)) callback(index)
      }
    },
    /**
     * Deliver a trusted selection update.
     * @param variantId Id of the selected story variant.
     * @param selectionVersion Monotone version used to reject stale selection messages.
     */
    select(variantId: string, selectionVersion: number) {
      return receive({ type: protocol.PREVIEW_SYNC, storyId, variantId, documentId: options.documentId ?? 'document', selectionVersion })
    },
    receive,
    /** Vue watchers and fixture elements belong to this app alone. */
    close() {
      app.unmount()
      container.remove()
    },
  }
}
