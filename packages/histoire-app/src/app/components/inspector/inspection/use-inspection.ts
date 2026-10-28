import type { HistoireAccessibilityInspection, HistoireComponentInspection, HistoireComponentTreeInspection, HistoireDomInspection, HistoireHighlightLease, HistoireInspectionCapabilities, HistoireReadonly, HistoireVariantInspection } from '@histoire/protocol'
import type { HistoireSession } from '@histoire/sdk'
import type { WorkbenchHost } from '../../../extensions/create-workbench-host.js'
import { HistoireSdkError, sameInspectionOwner } from '@histoire/protocol'
import { getHistoireSessionDescriptor } from '@histoire/sdk/internal'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { captureInspectionFrame } from './frame-owner.js'

/** Reads a selected frame without transferring ownership of its session or runtime. */
export function useInspection(session: HistoireSession, workbench?: WorkbenchHost, sourceSession: HistoireSession = session) {
  const revision = ref(0)
  const result = shallowRef<HistoireReadonly<HistoireVariantInspection>>()
  const domResult = shallowRef<HistoireReadonly<HistoireDomInspection>>()
  const components = shallowRef<HistoireReadonly<HistoireComponentTreeInspection>>()
  const component = shallowRef<HistoireReadonly<HistoireComponentInspection>>()
  const audit = shallowRef<HistoireReadonly<HistoireAccessibilityInspection>>()
  const lease = shallowRef<HistoireReadonly<HistoireHighlightLease>>()
  const error = ref<string>()
  const running = ref(false)
  const operationLabel = ref<'state' | 'DOM' | 'components' | 'component' | 'accessibility audit' | 'highlight'>('state')
  let operation: AbortController | undefined
  let leaseTimer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  const stopSession = session.subscribe(() => revision.value++)
  const stopSource = sourceSession === session ? undefined : sourceSession.subscribe(() => revision.value++)
  const stopFrame = workbench?.selectedFrame.subscribe(() => revision.value++)

  /** Capture the exact active owner rather than a cached inspector context. */
  function capture() {
    const frame = captureInspectionFrame(session, workbench?.selectedFrame.current())
    const root = sourceSession.getSnapshot()
    if (!frame || root.status !== 'ready' || root.stale || root.source?.sourceId !== frame.owner.sourceId || root.source?.epoch !== frame.owner.epoch || root.source?.revision !== frame.owner.revision || root.selection?.storyId !== frame.owner.target.storyId || root.selection?.variantId !== frame.owner.target.variantId) return
    return frame
  }

  /** Effective actor support never exceeds the current canonical source grant. */
  function granted(capability: keyof HistoireInspectionCapabilities): boolean {
    try {
      return getHistoireSessionDescriptor(sourceSession).inspection?.[capability]?.available === true
        && session.getSnapshot().inspection?.[capability]?.available === true
    }
    catch { return false }
  }

  const variantAvailable = computed(() => {
    void revision.value
    return Boolean(capture() && granted('variant'))
  })
  const domAvailable = computed(() => {
    void revision.value
    return Boolean(capture() && granted('dom'))
  })
  const componentsAvailable = computed(() => {
    void revision.value
    return Boolean(capture() && granted('components'))
  })
  const componentDetailsAvailable = computed(() => {
    void revision.value
    return Boolean(capture() && granted('componentDetails'))
  })
  const auditAvailable = computed(() => {
    void revision.value
    return Boolean(capture() && granted('accessibilityAudit'))
  })
  const pickAvailable = computed(() => {
    void revision.value
    return Boolean(capture() && granted('pick'))
  })
  const highlightAvailable = computed(() => {
    void revision.value
    return Boolean(capture() && granted('highlightLease'))
  })
  const available = computed(() => variantAvailable.value || domAvailable.value || componentsAvailable.value || auditAvailable.value || pickAvailable.value || highlightAvailable.value)
  /** Distinguishes A/B/A visits even when their target and source strings repeat. */
  const identity = computed(() => {
    void revision.value
    const captured = capture()
    return captured ? JSON.stringify([captured.owner, captured.frame.context.frame.key]) : ''
  })
  /** Release only the exact overlay lease this panel owns. */
  async function clearLease(reportFailure = false) {
    const old = lease.value
    const request = generation
    const captured = capture()
    lease.value = undefined
    clearTimeout(leaseTimer)
    leaseTimer = undefined
    if (!old) return
    try {
      await session.inspect.clearHighlight({ target: old.owner.target, expectedOwner: old.owner, leaseId: old.leaseId })
    }
    catch (cause) {
      if (reportFailure && request === generation && captured && capture()?.frame === captured.frame && sameInspectionOwner(captured.owner, old.owner)) error.value = cause instanceof HistoireSdkError ? cause.message.replace(/preview/gi, 'variant') : cause instanceof Error ? cause.message : 'Could not clear highlight'
    }
  }
  /** Clears data and cancels only this panel's work. */
  function retire() {
    generation++
    operation?.abort()
    void clearLease()
    operation = undefined
    running.value = false
    error.value = undefined
    result.value = undefined
    domResult.value = undefined
    components.value = undefined
    component.value = undefined
    audit.value = undefined
  }
  const currentFrame = computed(() => {
    void revision.value
    return workbench?.selectedFrame.current()
  })
  watch(currentFrame, (frame, _previous, onCleanup) => {
    if (!frame) return
    const onAbort = () => revision.value++
    frame.signal.addEventListener('abort', onAbort, { once: true })
    onCleanup(() => frame.signal.removeEventListener('abort', onAbort))
  }, { immediate: true, flush: 'sync' })
  watch([identity, currentFrame, variantAvailable, domAvailable, componentsAvailable, componentDetailsAvailable, auditAvailable, pickAvailable, highlightAvailable], retire, { flush: 'sync' })

  /** Retire a prior DOM read when a later point pick finds no element. */
  function clearDom() {
    generation++
    operation?.abort()
    operation = undefined
    running.value = false
    error.value = undefined
    domResult.value = undefined
  }

  /** Explicit read; failures retain successful results for this owner. */
  async function read(kind: 'variant' | 'dom' | 'components' | 'component' | 'accessibility', value?: string) {
    const captured = capture()
    const allowed = kind === 'variant' ? variantAvailable.value : kind === 'dom' ? domAvailable.value : kind === 'components' ? componentsAvailable.value : kind === 'component' ? componentDetailsAvailable.value : auditAvailable.value
    if (!captured || !allowed || (kind === 'component' && !value)) return
    operation?.abort()
    const controller = new AbortController()
    operation = controller
    const request = ++generation
    const abort = () => controller.abort()
    captured.frame.signal.addEventListener('abort', abort, { once: true })
    running.value = true
    operationLabel.value = kind === 'variant' ? 'state' : kind === 'dom' ? 'DOM' : kind === 'accessibility' ? 'accessibility audit' : kind
    if (kind === 'component') component.value = undefined
    error.value = undefined
    try {
      const options = { target: captured.owner.target, expectedOwner: captured.owner, signal: controller.signal }
      const next = kind === 'variant' ? await session.inspect.variant(options) : kind === 'dom' ? await session.inspect.dom({ ...options, ...(value ? { selector: value } : {}) }) : kind === 'components' ? await session.inspect.components(options) : kind === 'component' ? await session.inspect.component({ ...options, componentId: value! }) : await session.inspect.accessibility(options)
      const current = capture()
      if (request === generation && !controller.signal.aborted && current?.frame === captured.frame && sameInspectionOwner(current.owner, captured.owner) && sameInspectionOwner(next.owner, captured.owner)) {
        if (next.inspection === 'variant') {
          result.value = next
        }
        else if (next.inspection === 'dom') {
          domResult.value = next
        }
        else if (next.inspection === 'components') {
          components.value = next
          component.value = undefined
        }
        else if (next.inspection === 'component') {
          component.value = next
        }
        else {
          audit.value = next
        }
      }
    }
    catch (cause) {
      if (request === generation && !controller.signal.aborted && capture()?.frame === captured.frame) error.value = cause instanceof HistoireSdkError ? cause.message.replace(/preview/gi, 'variant') : cause instanceof Error ? cause.message : 'Inspection failed'
    }
    finally {
      captured.frame.signal.removeEventListener('abort', abort)
      if (request === generation) {
        operation = undefined
        running.value = false
      }
    }
  }
  /** Create one bounded lease, clearing any predecessor without touching other owners. */
  async function highlight(selector: string) {
    const captured = capture()
    if (!captured || !highlightAvailable.value || !selector) return
    operation?.abort()
    const controller = new AbortController()
    operation = controller
    const request = ++generation
    const abort = () => controller.abort()
    captured.frame.signal.addEventListener('abort', abort, { once: true })
    running.value = true
    operationLabel.value = 'highlight'
    error.value = undefined
    try {
      await clearLease()
      const before = capture()
      if (request !== generation || controller.signal.aborted || !highlightAvailable.value || before?.frame !== captured.frame || !sameInspectionOwner(before.owner, captured.owner)) return
      const next = await session.inspect.highlightLease({ selector, durationMs: 5000, target: captured.owner.target, expectedOwner: captured.owner, signal: controller.signal })
      const current = capture()
      if (request !== generation || controller.signal.aborted || current?.frame !== captured.frame || !sameInspectionOwner(current.owner, captured.owner)) {
        void session.inspect.clearHighlight({ target: next.owner.target, expectedOwner: next.owner, leaseId: next.leaseId }).catch(() => {})
        return
      }
      lease.value = next
      leaseTimer = setTimeout(() => {
        if (lease.value === next) lease.value = undefined
      }, 5000)
    }
    catch (cause) {
      if (request === generation && !controller.signal.aborted) error.value = cause instanceof HistoireSdkError ? cause.message.replace(/preview/gi, 'variant') : cause instanceof Error ? cause.message : 'Highlight failed'
    }
    finally {
      captured.frame.signal.removeEventListener('abort', abort)
      if (request === generation) {
        operation = undefined
        running.value = false
      }
    }
  }
  onScopeDispose(() => {
    retire()
    stopSession()
    stopSource?.()
    stopFrame?.()
  })
  return { capture, available, variantAvailable, domAvailable, componentsAvailable, componentDetailsAvailable, auditAvailable, pickAvailable, highlightAvailable, result, domResult, components, component, audit, lease, error, running, operationLabel, clearDom, readState: () => read('variant'), readDom: (selector?: string) => read('dom', selector), readComponents: () => read('components'), readComponent: (id: string) => read('component', id), runAudit: () => read('accessibility'), highlight, clearHighlight: () => clearLease(true) }
}
