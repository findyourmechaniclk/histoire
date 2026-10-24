import type { CanvasScopedContext, CanvasViewContext, ContributionKind } from '@histoire/plugin-kit'
import type { InjectionKey } from 'vue'
import type { CanvasFrames } from '../../composables/canvas-settings.js'
import type { CanvasContextHandle } from '../../extensions/canvas-service.js'
import type { WorkbenchHost } from '../../extensions/create-workbench-host.js'
import type { CanvasStore } from '../../stores/canvas.js'
import type { CanvasFrameLeases } from './frames/frame-leases.js'
import type { CanvasPluginTools } from './tools/plugin-tools.js'
import { inject, onScopeDispose, provide, ref } from 'vue'
import { useOptionalExtensionHost } from '../../composables/extensions.js'
import { createCanvasScopedContext, createCanvasService, createCanvasViewContext } from '../../extensions/canvas-service.js'
import { useShortcutRegistry } from '../../util/shortcuts.js'
import { provideCanvasPluginTools, useCanvasPluginTools } from './tools/plugin-tools.js'

/** Plugin surfaces of one canvas viewport. */
export interface CanvasExtensions {
  /** Workbench extension host; absent outside a workbench (native hosts, tests). */
  workbench: WorkbenchHost | undefined
  /** Canvas-scoped context handed to overlays, tools and views; absent without a host. */
  context: CanvasScopedContext | undefined
  /** Registry-backed plugin tools. */
  tools: CanvasPluginTools
  /** Whether any contribution of `kind` is registered; reactive to registry changes. */
  has: (kind: ContributionKind) => boolean
  /**
   * Context of one mounted custom view; its leases may take the whole budget and are released
   * by `dispose`; its `requestLayout` calls `requestLayout` until then. Absent without a host.
   */
  viewContext: (requestLayout: () => void) => CanvasContextHandle<CanvasViewContext> | undefined
}

/** Inputs of one viewport's plugin surfaces. */
export interface CanvasExtensionsOptions {
  /** Camera and tool owner. */
  canvas: CanvasStore
  /** Viewport frame registry. */
  frames: CanvasFrames
  /** Viewport element. */
  viewport: () => HTMLElement | undefined
  /** Plugin frame leases of the viewport. */
  leases: Pick<CanvasFrameLeases, 'acquire'>
}

const canvasExtensionsKey: InjectionKey<CanvasExtensions> = Symbol('histoire-canvas-extensions')

/**
 * Create and provide the plugin surfaces of one canvas viewport: the canvas service and
 * canvas-scoped context, and the plugin tools. Everything is released with the viewport.
 */
export function useCanvasExtensions(options: CanvasExtensionsOptions): CanvasExtensions {
  // The canvas also renders in native hosts and isolated tests without a workbench host.
  const workbench = useOptionalExtensionHost()
  const service = createCanvasService({ canvas: options.canvas, frames: options.frames, viewport: options.viewport, acquireFrame: (target, request) => options.leases.acquire(target, request) })
  const scoped = workbench ? createCanvasScopedContext(workbench.context, service.service) : undefined
  const tools = useCanvasPluginTools({ workbench, canvas: options.canvas, context: scoped?.context, shortcuts: useShortcutRegistry() })
  // Registry snapshots are not reactive: a host notification bumps this revision.
  const revision = ref(0)
  if (workbench) {
    onScopeDispose(workbench.host.subscribe(() => revision.value++))
    // Plugin channels reach this canvas's frames (leases included) by canvas frame id.
    if (typeof window !== 'undefined') onScopeDispose(workbench.frames.registerFrames(options.frames, window))
    // Inspector contexts key a published session by the frame owning it (leases included).
    onScopeDispose(workbench.selectedFrame.bindFrameKeys(session => [...options.frames.frames.values()].find(entry => entry.session === session)?.id))
  }
  const extensions: CanvasExtensions = {
    workbench,
    context: scoped?.context,
    tools,
    has(kind) {
      void revision.value
      return !!workbench && workbench.host.contributions(kind).length > 0
    },
    viewContext: requestLayout => workbench && createCanvasViewContext(workbench.context, service.service, options.leases.acquire, requestLayout),
  }
  provide(canvasExtensionsKey, extensions)
  provideCanvasPluginTools(tools)
  onScopeDispose(() => {
    scoped?.dispose()
    service.dispose()
  })
  return extensions
}

/** Plugin surfaces of the nearest canvas viewport. */
export function injectCanvasExtensions(): CanvasExtensions | undefined {
  return inject(canvasExtensionsKey, undefined)
}
