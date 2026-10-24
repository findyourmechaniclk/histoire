import type { CanvasViewContext, QualifiedContribution, ToolbarGroup } from '@histoire/plugin-kit'
import type { HistoireTarget } from '@histoire/protocol'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { CanvasFrameRegistration, CanvasFrames } from '../../../composables/canvas-settings.js'
import type { WorkbenchHost } from '../../../extensions/create-workbench-host.js'
import type { ContributionPresence } from '../../../extensions/shell-registry.js'
import type { CanvasArrangement, PluginCanvasArrangement } from '../../../stores/canvas-arrangement.js'
import type { CanvasFitTarget } from '../../../stores/canvas-types.js'
import type { CanvasExtensions } from '../canvas-extensions.js'
import { computed, ref, shallowRef, watch } from 'vue'
import { useContributionLookup } from '../../../composables/shell-extensions.js'
import { isPluginContributionId } from '../../../extensions/shell-registry.js'
import { canvasFrameBounds } from '../frame-layout.js'
import { LEASE_FRAME_PREFIX } from '../frames/frame-leases.js'

/** Registered custom canvas view. */
export type CanvasViewContribution = QualifiedContribution<'canvas.view'>

/** Views whose `layout` already failed, so the failure is reported once. */
const failedLayouts = new WeakSet<CanvasViewContribution>()

/** Toolbar groups every view shows: the arrangement switch and the inspector toggle. */
const ALWAYS_VISIBLE: ReadonlySet<ToolbarGroup> = new Set(['arrange', 'inspector'])

/** Registry state of the active arrangement when it is a plugin view. */
export interface ActiveCanvasView {
  /** Qualified id of the active plugin view; `undefined` for built-in arrangements. */
  id: ComputedRef<PluginCanvasArrangement | undefined>
  /** Registered descriptor of the active plugin view, once available. */
  view: ComputedRef<CanvasViewContribution | undefined>
  /** Presence of the active plugin view (`missing` for built-ins). */
  presence: ComputedRef<ContributionPresence>
  /** Extension host of the workbench, absent outside one. */
  workbench: WorkbenchHost | undefined
  /** Whether the toolbar shows `group` for the active arrangement; reactive. */
  showsGroup: (group: ToolbarGroup) => boolean
  /** Bumped when the mounted view calls `requestLayout`; the viewport re-measures on change. */
  layoutRevision: Ref<number>
}

/**
 * Track the plugin view behind an arrangement. Built-in arrangements show every toolbar group;
 * a plugin view shows the groups it declares (all when it declares none), and only the
 * always-visible ones while its descriptor is not available yet.
 * @param arrangement Active arrangement.
 */
export function useCanvasViewDescriptor(arrangement: () => CanvasArrangement): ActiveCanvasView {
  const lookup = useContributionLookup('canvas.view')
  const id = computed(() => {
    const value = arrangement()
    return isPluginContributionId(value) ? value : undefined
  })
  const view = computed(() => id.value ? lookup.list().find(candidate => candidate.id === id.value) : undefined)
  const presence = computed<ContributionPresence>(() => id.value ? lookup.presence(id.value) : 'missing')
  return {
    id,
    view,
    presence,
    workbench: lookup.workbench,
    layoutRevision: ref(0),
    showsGroup(group) {
      if (!id.value || ALWAYS_VISIBLE.has(group)) return true
      const groups = view.value?.toolbar
      return !!view.value && (!groups || groups.includes(group))
    },
  }
}

/**
 * Canvas-scoped context of the active plugin view. Each view (id or re-registered descriptor)
 * gets a fresh context. The previous one is disposed synchronously when the arrangement
 * changes, before the next arrangement renders and admits frames, so the leases it owned are
 * already released when the selected runtime moves to the next view. `requestLayout` bumps
 * `active.layoutRevision`; the viewport's post-flush measure watcher coalesces repeated calls.
 * @param active Active plugin view.
 * @param extensions Plugin surfaces of the viewport.
 */
export function useCanvasViewContext(active: ActiveCanvasView, extensions: Pick<CanvasExtensions, 'viewContext'>): Readonly<ShallowRef<CanvasViewContext | undefined>> {
  const context = shallowRef<CanvasViewContext>()
  watch([active.id, active.view], ([id], _, onCleanup) => {
    const handle = id ? extensions.viewContext(() => active.layoutRevision.value++) : undefined
    context.value = handle?.context
    if (handle) onCleanup(handle.dispose)
  }, { immediate: true, flush: 'sync' })
  return context
}

/**
 * Fit bounds of a plugin view from its `layout`, or `undefined` (Fit keeps the camera) when it
 * declares none. A throwing layout is reported once and treated as empty.
 * @param view Active view descriptor.
 * @param workbench Extension host receiving the failure.
 */
export function canvasViewFitBounds(view: CanvasViewContribution | undefined, workbench: WorkbenchHost | undefined): CanvasFitTarget | undefined {
  const layout = view?.layout
  if (!view || !layout) return undefined
  return (zoom) => {
    try {
      return canvasFrameBounds([...layout(zoom)])
    }
    catch (error) {
      // Fit solves iteratively and re-measures often: report each registered view once.
      if (!failedLayouts.has(view)) workbench?.host.reportViewError(view.id, error, 'report')
      failedLayouts.add(view)
      return { x: 0, y: 0, width: 0, height: 0 }
    }
  }
}

/**
 * Frame publishing `target` to the inspector in a custom view: the first leased frame showing
 * that variant, preferring one with a rendered document.
 * @param frames Viewport frame registry.
 * @param target Selected variant.
 */
export function leasedFrameFor(frames: CanvasFrames, target: HistoireTarget): CanvasFrameRegistration | null {
  const candidates = [...frames.frames.values()].filter(entry => entry.id.startsWith(LEASE_FRAME_PREFIX) && entry.storyId === target.storyId && entry.variantId === target.variantId)
  return candidates.find(entry => entry.iframe && entry.session) ?? candidates[0] ?? null
}
