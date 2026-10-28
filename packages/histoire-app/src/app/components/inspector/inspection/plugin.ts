import type { WorkbenchPluginApi, WorkbenchPluginManifestEntry } from '@histoire/plugin-kit'
import type { HistoireSession } from '@histoire/sdk'
import type { Ref } from 'vue'
import type { FrameContextHandle } from '../../../extensions/frame-context.js'
import type { InspectionPick } from './picker.js'
import { getHistoireSessionDescriptor } from '@histoire/sdk/internal'
import { defineAsyncComponent, defineComponent, h, shallowRef, watch } from 'vue'
import { createInspectionPicker } from './picker.js'

/** Reserved internal namespace; user entries are never replaced. */
const INSPECTION_PLUGIN_ID = 'histoire-inspection'
/** Panel code is loaded only when its contribution is opened. */
const InspectionPanel = defineAsyncComponent(() => import('./InspectionPanel.vue'))

/** Registers a tab only while the connected source grants supported inspection. */
function setupInspection(api: WorkbenchPluginApi, session: HistoireSession, current: Readonly<Ref<HistoireSession>>, selected: () => FrameContextHandle | null): () => void {
  let remove: (() => void) | undefined
  let removeTool: (() => void) | undefined
  let last = ''
  const picked = shallowRef<InspectionPick>()
  const picker = createInspectionPicker(api, session, current, selected, value => picked.value = value)
  const view = defineComponent({
    setup() {
      return () => h(InspectionPanel, { picked: picked.value, sourceSession: session })
    },
  })
  /** Keep contribution aligned with coherent source publications. */
  function synchronize() {
    const snapshot = session.getSnapshot()
    const owner = current.value.getSnapshot()
    const source = snapshot.source
    let sourceGranted = false
    let sourcePickGranted = false
    try {
      const inspection = getHistoireSessionDescriptor(session).inspection
      sourcePickGranted = inspection?.pick?.available === true
      sourceGranted = inspection?.variant?.available === true || inspection?.dom?.available === true || inspection?.components?.available === true || inspection?.accessibilityAudit?.available === true || inspection?.pick?.available === true || inspection?.highlightLease?.available === true
    }
    catch { /* A disconnected source grants nothing. */ }
    const ready = owner.status === 'ready' && !owner.stale && owner.runtime.status === 'ready'
      && owner.source?.sourceId === source?.sourceId && owner.source?.epoch === source?.epoch && owner.source?.revision === source?.revision
      && owner.selection?.storyId === snapshot.selection?.storyId && owner.selection?.variantId === snapshot.selection?.variantId
      && (owner.inspection?.variant?.available === true || owner.inspection?.dom?.available === true || owner.inspection?.components?.available === true || owner.inspection?.accessibilityAudit?.available === true || owner.inspection?.pick?.available === true || owner.inspection?.highlightLease?.available === true)
    // Keep a source-granted placeholder while the canvas admits a selected frame. It has no
    // execution authority: the panel independently requires the current ready actor.
    const pending = current.value === session && owner.runtime.status !== 'ready' && Boolean(snapshot.selection?.variantId)
    const permitted = snapshot.status === 'ready' && !snapshot.stale && sourceGranted && (ready || pending)
    const canPick = permitted && ready && sourcePickGranted && owner.inspection?.pick?.available === true
    const key = JSON.stringify([source?.sourceId, source?.epoch, source?.revision, snapshot.selection, ready, pending, permitted, canPick])
    if (key === last) return
    last = key
    if (permitted && !remove) {
      remove = api.inspector.addTab({
        id: 'state',
        label: 'Inspection',
        icon: 'search',
        component: view,
        available: (context) => {
          const current = context.runtime.getSnapshot()
          return current.status === 'ready' && !current.stale && current.runtime.status === 'ready' && (current.inspection?.variant?.available === true || current.inspection?.dom?.available === true || current.inspection?.components?.available === true || current.inspection?.accessibilityAudit?.available === true || current.inspection?.pick?.available === true || current.inspection?.highlightLease?.available === true)
        },
      })
    }
    else if (!permitted && remove) {
      remove()
      remove = undefined
    }
    if (canPick && !removeTool) {
      removeTool = api.canvas.addTool({ id: 'pick', label: 'Pick element', icon: 'cursor-1', cursor: 'crosshair', available: context => typeof context.canvas.viewportToFrame === 'function', onPointerUp: (event, context) => void picker.pick(event, context), onCancel: picker.cancel, onDeactivate: picker.cancel })
    }
    else if (!canPick && removeTool) {
      picker.cancel()
      removeTool()
      removeTool = undefined
    }
    api.invalidate()
  }
  let stopActor: (() => void) | undefined
  const stopSource = session.subscribe(synchronize)
  const stopCurrent = watch(current, (owner) => {
    stopActor?.()
    picker.cancel()
    stopActor = owner === session ? undefined : owner.subscribe(synchronize)
    synchronize()
  }, { immediate: true, flush: 'sync' })
  return () => {
    stopCurrent()
    stopActor?.()
    stopSource()
    picker.cancel()
    removeTool?.()
    removeTool = undefined
    remove?.()
    remove = undefined
  }
}

/** Append the internal opt-in entry without taking over an identically named user plugin. */
export function inspectionPluginEntries(entries: readonly WorkbenchPluginManifestEntry[], enabled: boolean, session: HistoireSession, current: Readonly<Ref<HistoireSession>>, warn: (message: string) => void, selected: () => FrameContextHandle | null = () => null): readonly WorkbenchPluginManifestEntry[] {
  if (!enabled) return entries
  if (entries.some(entry => entry.id === INSPECTION_PLUGIN_ID)) {
    warn('Inspection panel unavailable: plugin id "histoire-inspection" is already in use.')
    return entries
  }
  return [...entries, {
    id: INSPECTION_PLUGIN_ID,
    apiVersion: 1,
    options: undefined,
    load: async () => ({ default: { id: INSPECTION_PLUGIN_ID, apiVersion: 1, setup: (api: WorkbenchPluginApi) => setupInspection(api, session, current, selected) } }),
  }]
}
