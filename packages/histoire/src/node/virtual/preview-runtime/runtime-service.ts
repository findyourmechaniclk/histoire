import { createDebugBuffer } from '@histoire/protocol'
import { inspectDomDocument, observeRuntimeDiagnostics, projectVariantState } from '@histoire/shared/inspection'
import { createRuntimeDebug } from './debug-service.js'
import { createRuntimeHighlight } from './highlight.js'

/** Emits finite runtime services inside existing preview app setup scope. */
export function previewRuntimeService() {
  return `    const runtimeDebug = (${createRuntimeDebug.toString()})(window, ${createDebugBuffer.toString()}, ${observeRuntimeDiagnostics.toString()})
    const runtimeHighlight = (${createRuntimeHighlight.toString()})(document, window)
    let inspectionGeneration = 0
    function resetRuntimeHighlight() { runtimeHighlight.close() }
    /** HMR revokes actor grants before rebuilding its provider or publishing again. */
    window.addEventListener('histoire:inspection-retire', event => {
      if (event.detail?.storyId !== story.value?.id) return
      inspectionGeneration++
      resetRuntimeHighlight()
      resetRuntimeDiagnostics()
      resetRuntimeScans()
      const variantId = variant.value?.id
      for (const root of runtimeInspectionRoots(variantId)) invalidateFrameworkInspection(root)
      postToParent({ type: 'histoire:inspection-capabilities', storyId: story.value?.id, variantId, inspectionCapabilities: {} })
    })
    window.addEventListener('pagehide', () => runtimeHighlight.close(), { once: true })
    const diagnosticRequests = new Map()
    const runtimeScans = new Map()
    function resetRuntimeDiagnostics() { diagnosticRequests.clear(); runtimeDebug.reset() }
    function resetRuntimeScans() { for (const scan of runtimeScans.values()) scan.abort.abort(); runtimeScans.clear() }
    window.addEventListener('histoire:runtime-failed', () => {
      inspectionGeneration++
      resetRuntimeHighlight()
      resetRuntimeDiagnostics()
      resetRuntimeScans()
      for (const root of runtimeInspectionRoots(variant.value?.id)) invalidateFrameworkInspection(root)
    })
    window.addEventListener('pagehide', () => { diagnosticRequests.clear(); runtimeDebug.close(); resetRuntimeScans() }, { once: true })
    const inspectVariantState = ${projectVariantState.toString()}
    const inspectRuntimeDom = ${inspectDomDocument.toString()}
    /** One exact actor root grants provider access only after framework registration. */
    function runtimeInspectionRoots(variantId) {
      return Array.from(document.querySelectorAll('[data-histoire-runtime-content][data-histoire-variant-id]')).filter(element => element.getAttribute('data-histoire-variant-id') === variantId)
    }
    function getRuntimeInspectionCapabilities(variantId) {
      if (histoireConfig.inspection?.enabled !== true || initialSelection.controls) return {}
      const roots = runtimeInspectionRoots(variantId)
      if (roots.length !== 1) return {}
      const capabilities = { variant: { available: true }, dom: { available: true }, highlight: { available: true }, highlightLease: { available: true }, pick: { available: true } }
      if (histoireConfig.inspection.diagnostics === true) capabilities.diagnostics = { available: true }
      if (histoireConfig.inspection.accessibility === true && typeof runtimeAccessibilityAvailable !== 'undefined' && runtimeAccessibilityAvailable) capabilities.accessibilityAudit = { available: true }
      const provider = histoireConfig.inspection.components === true ? getFrameworkInspection(roots[0]) : undefined
      if (provider) {
        capabilities.components = { available: true }
        capabilities.componentDetails = { available: true }
        if (typeof provider.resolveComponentElement === 'function') capabilities.componentHighlight = { available: true }
      }
      return capabilities
    }
    const runtimeStates = new Map()
    const runtimePresets = new Map()
    function getRuntimePresets(targetVariant) {
      let presets = runtimePresets.get(targetVariant)
      if (!presets) {
        const persistence = new URLSearchParams(window.location.search).get('standalone') === 'true' && !initialSelection.controls
          ? createStandalonePresetStorage(() => window.localStorage, { storyId: story.value.id, variantId: targetVariant.id })
          : undefined
        presets = createRuntimeStatePresets(() => targetVariant.state, value => toRawDeep(value, true), persistence,
          () => getRuntimeState(targetVariant).reset())
        runtimePresets.set(targetVariant, presets)
      }
      return presets
    }
    function getRuntimeState(targetVariant) {
      let state = runtimeStates.get(targetVariant)
      if (!state) {
        state = createRuntimeState(() => targetVariant.state, value => toRawDeep(value, true))
        runtimeStates.set(targetVariant, state)
      }
      return state
    }
    async function handleRuntimeRequest(message) {
      if (message.command === 'inspection.revoke') {
        if (message.documentId === previewDocumentId && message.storyId === story.value?.id && message.variantId === variant.value?.id) runtimeHighlight.revoke(message.payload ?? {})
        return
      }
      if (message.command === 'inspection.cancel') {
        runtimeHighlight.cancel(message.requestId, message.inspectionOwner)
        const scan = runtimeScans.get(message.requestId)
        if (scan && JSON.stringify(scan.owner) === JSON.stringify(message.inspectionOwner)) scan.abort.abort()
        const pending = diagnosticRequests.get(message.requestId)
        if (pending && message.documentId === previewDocumentId && JSON.stringify(pending.bridgeOwner) === JSON.stringify(message.inspectionOwner)) {
          diagnosticRequests.delete(message.requestId)
          try { runtimeDebug.run({ ...pending.input, action: 'stop' }, pending.bridgeOwner) } catch {}
        }
        return
      }
      const targetVariant = getVariantById(message.variantId)
      if (message.storyId !== story.value?.id || !targetVariant || !readyVariantIds.has(targetVariant.id)) return
      const targetStory = story.value
      // Generated-service harnesses without a selection lifecycle still exercise legacy calls.
      const capturedSelection = typeof selectionToken === 'undefined' ? null : selectionToken
      const capturedGeneration = inspectionGeneration
      const current = () => story.value === targetStory && getVariantById(targetVariant.id) === targetVariant && readyVariantIds.has(targetVariant.id) && capturedGeneration === inspectionGeneration && (capturedSelection === null || capturedSelection === selectionToken)
      try {
        let result
        if (['inspection.variant', 'inspection.dom', 'inspection.debug', 'inspection.highlight', 'inspection.highlightLease', 'inspection.highlightClear', 'inspection.pick', 'inspection.components', 'inspection.component', 'inspection.componentForElement', 'inspection.accessibility'].includes(message.command) && message.inspection !== true) {
          const owner = message.inspectionOwner
          if (!owner || owner.runtimeId !== previewDocumentId || owner.target?.storyId !== targetStory.id || owner.target?.variantId !== targetVariant.id || message.documentId !== previewDocumentId) return
          if (histoireConfig.inspection?.enabled !== true || initialSelection.controls) throw Object.assign(new Error('Inspection unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
          const roots = runtimeInspectionRoots(targetVariant.id)
          if (roots.length !== 1) throw Object.assign(new Error('Mounted target unavailable'), { code: 'PREVIEW_NOT_READY' })
          const started = performance.now()
          const input = message.payload
          let projection
          const publicOwner = { sourceId: owner.sourceId, epoch: owner.epoch, revision: owner.revision, runtimeId: owner.runtimeId, target: owner.target }
          if (message.command === 'inspection.pick') {
            const width = document.documentElement.clientWidth || window.innerWidth
            const height = document.documentElement.clientHeight || window.innerHeight
            const element = input.x >= 0 && input.y >= 0 && input.x < width && input.y < height ? document.elementFromPoint(input.x, input.y) : null
            const selector = element && roots[0].contains(element) ? element === roots[0] ? ':scope' : inspectionSelector(element) : null
            result = { owner: publicOwner, observedAt: new Date().toISOString(), matched: Boolean(selector && selector.length <= 512), ...(selector && selector.length <= 512 ? { selector } : {}) }
          }
          else if (message.command === 'inspection.highlightClear') {
            result = { owner: publicOwner, cleared: runtimeHighlight.clear(input.leaseId, owner) }
          }
          else if (message.command === 'inspection.highlight' || message.command === 'inspection.highlightLease') {
            let leaseId
            if (typeof input.componentId === 'string' && input.selector === undefined) {
              if (histoireConfig.inspection?.components !== true) throw Object.assign(new Error('Component highlight unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
              const provider = getFrameworkInspection(roots[0])
              if (!provider || typeof provider.resolveComponentElement !== 'function') throw Object.assign(new Error('Component highlight unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
              const element = provider.resolveComponentElement(input.componentId)
              if (!current() || getFrameworkInspection(roots[0]) !== provider || runtimeInspectionRoots(targetVariant.id).length !== 1 || runtimeInspectionRoots(targetVariant.id)[0] !== roots[0]) throw Object.assign(new Error('Component owner changed'), { code: 'RUNTIME_CHANGED' })
              leaseId = runtimeHighlight.showElement(roots[0], element, input.durationMs ?? 1000, message.requestId, owner, message.command === 'inspection.highlightLease' ? 'highlightLease' : 'highlight', () => current() && getFrameworkInspection(roots[0]) === provider && provider.resolveComponentElement(input.componentId) === element)
            }
            else {
              if (typeof input.selector !== 'string' || input.componentId !== undefined) throw Object.assign(new Error('Highlight unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
              leaseId = runtimeHighlight.show(roots[0], input.selector, input.durationMs ?? 1000, message.requestId, owner, message.command === 'inspection.highlightLease' ? 'highlightLease' : 'highlight')
            }
            result = { owner: publicOwner, observedAt: new Date().toISOString(), ...(message.command === 'inspection.highlightLease' ? { leaseId } : {}) }
          }
          else if (message.command === 'inspection.debug') {
            if (histoireConfig.inspection?.enabled !== true || histoireConfig.inspection?.diagnostics !== true || initialSelection.controls) throw Object.assign(new Error('Diagnostics unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
            projection = runtimeDebug.run(input, owner)
            if (input.action === 'start') diagnosticRequests.set(message.requestId, { input, bridgeOwner: owner })
            if (input.action === 'stop') {
              for (const [id, pending] of diagnosticRequests) if (pending.input.observationId === input.observationId && JSON.stringify(pending.bridgeOwner) === JSON.stringify(owner)) diagnosticRequests.delete(id)
            }
            projection.truncated = projection.gap || projection.droppedCount > 0
          }
          else if (['inspection.components', 'inspection.component', 'inspection.componentForElement'].includes(message.command)) {
            if (histoireConfig.inspection?.enabled !== true || histoireConfig.inspection?.components !== true || initialSelection.controls) throw Object.assign(new Error('Component inspection unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
            const provider = getFrameworkInspection(roots[0])
            if (!provider) throw Object.assign(new Error('Component inspection unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
            if (message.command === 'inspection.components') projection = provider.components(input)
            else if (message.command === 'inspection.component') projection = provider.component(input.componentId)
            else projection = provider.componentForElement(input.selector)
            if (!current() || getFrameworkInspection(roots[0]) !== provider) throw Object.assign(new Error('Component owner changed'), { code: 'RUNTIME_CHANGED' })
          }
          else if (message.command === 'inspection.accessibility') {
            if (histoireConfig.inspection?.enabled !== true || histoireConfig.inspection?.accessibility !== true || initialSelection.controls || typeof runtimeAccessibilityAvailable === 'undefined' || !runtimeAccessibilityAvailable) throw Object.assign(new Error('Accessibility audit unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
            const scan = { owner, abort: new AbortController() }
            runtimeScans.set(message.requestId, scan)
            try { projection = await scanRuntimeAccessibility(roots[0], input.selector, { isActive: current, signal: scan.abort.signal }) }
            finally { if (runtimeScans.get(message.requestId) === scan) runtimeScans.delete(message.requestId) }
          }
          else if (message.command === 'inspection.variant') projection = inspectVariantState(targetVariant.state)
          else {
            try { projection = inspectRuntimeDom({ selector: input.selector ?? ':scope', maxNodes: input.maxNodes ?? 200, maxDepth: input.maxDepth ?? 8 }, roots[0]) }
            catch { throw Object.assign(new Error('Invalid inspection CSS selector'), { code: 'INVALID_SELECTOR' }) }
          }
          if (!['inspection.highlight', 'inspection.highlightLease', 'inspection.highlightClear', 'inspection.pick'].includes(message.command)) result = { mode: 'live', inspection: message.command.slice('inspection.'.length), owner: publicOwner, observedAt: new Date().toISOString(), durationMs: Math.max(0, performance.now() - started), ...projection }
        }
        else if (message.command === 'inspection.accessibility' && message.inspection === true) {
          const query = new URLSearchParams(window.location.search)
          const nonce = query.get('mcpNonce')
          const epoch = query.get('mcpEpoch')
          if (!nonce || !epoch || message.documentId !== previewDocumentId || message.mcpNonce !== nonce || message.mcpEpoch !== epoch) return
          if (histoireConfig.inspection?.enabled !== true || histoireConfig.inspection?.accessibility !== true || initialSelection.controls) throw Object.assign(new Error('Accessibility audit unavailable'), { code: 'CAPABILITY_UNAVAILABLE' })
          const roots = Array.from(document.querySelectorAll('[data-histoire-runtime-content][data-histoire-variant-id]')).filter(element => element.getAttribute('data-histoire-variant-id') === targetVariant.id)
          if (roots.length !== 1) throw Object.assign(new Error('Mounted target unavailable'), { code: 'PREVIEW_NOT_READY' })
          result = await scanRuntimeAccessibility(roots[0], message.payload?.selector, { isActive: current })
        }
        else if (message.command === 'state.get' && message.inspection === true) {
          const query = new URLSearchParams(window.location.search)
          if (message.documentId !== previewDocumentId || message.mcpNonce !== query.get('mcpNonce') || message.mcpEpoch !== query.get('mcpEpoch')) return
          result = inspectVariantState(targetVariant.state)
        }
        else {
          const state = getRuntimeState(targetVariant)
          if (message.command === 'channel.post') {
            if (targetVariant.id !== variant.value?.id) throw Object.assign(new Error('Host channel selection changed'), { code: 'RUNTIME_CHANGED' })
            runtimeHostChannels.receive(message.payload, { storyId: targetStory.id, variantId: targetVariant.id })
            result = null
          }
          else if (message.command === 'plugin.post') {
            // Captured target only proves the document is live; delivery follows the actor id.
            receiveFramePluginMessage(message.payload)
            result = null
          }
          else if (message.command === 'state.get') result = state.get()
          else if (message.command === 'state.patch') result = state.patch(message.payload)
          else if (message.command === 'state.reset') {
            result = state.reset()
            getRuntimePresets(targetVariant).clearSelection()
          }
          else if (message.command === 'controls.preset') {
            result = getRuntimePresets(targetVariant).execute(message.payload)
          }
          else if (message.command === 'source.get') {
            try { result = await getDynamicSourceCode(targetStory, targetVariant) }
            catch (error) { throw Object.assign(new Error(error?.message ?? 'Dynamic source generation failed'), { code: 'INTERNAL_ERROR' }) }
            if (!result) throw Object.assign(new Error('Dynamic source unavailable'), { code: 'SOURCE_UNAVAILABLE' })
          }
          else throw new Error('Unknown runtime service')
        }
        if (!current()) return
        postToParent({ type: RUNTIME_RESULT, requestId: message.requestId, storyId: targetStory.id, variantId: targetVariant.id, inspectionOwner: message.inspectionOwner, result })
      }
      catch (error) {
        if (!current()) return
        postToParent({ type: RUNTIME_RESULT, requestId: message.requestId, storyId: targetStory.id, variantId: targetVariant.id, inspectionOwner: message.inspectionOwner, error: { ...serializeTestError(error), ...(error?.code ? { code: error.code } : {}) } })
      }
    }
    const runtimeLayout = observeRuntimeLayout({
      getStoryId: () => story.value?.id,
      isReady: variantId => readyVariantIds.has(variantId),
      publish: viewports => postToParent({ type: RUNTIME_LAYOUT, storyId: story.value?.id, viewports }),
    })
    const runtimeHostChannels = installRuntimeHostChannels({
      enabled: Boolean(histoireConfig.embed?.enabled && histoireConfig.embed.channels?.length && !initialSelection.controls),
      names: histoireConfig.embed?.enabled && !initialSelection.controls ? histoireConfig.embed.channels ?? [] : [],
      documentId: previewDocumentId,
      storyId: () => story.value?.id,
      ready: target => target.storyId === story.value?.id && readyVariantIds.has(target.variantId),
      post: (channel, target) => postToParent({ type: HOST_CHANNEL_MESSAGE, channel, ...target }),
    })
    window.addEventListener('pagehide', () => runtimeHostChannels.close(), { once: true })
    const closeRuntimeEvents = installRuntimeEventScope(() => story.value?.id,
      new URLSearchParams(window.location.search).get('embed') === 'true'
        ? (focused, action) => postToParent({ type: RUNTIME_FOCUS, storyId: story.value?.id, variantId: variant.value?.id, focused, action })
        : undefined,
      message => postToParent(message))
    window.addEventListener('pagehide', closeRuntimeEvents, { once: true })
    window.addEventListener('pagehide', () => runtimeLayout.close(), { once: true })
    // Navigation away: frame plugins detach while the document is still alive.
    window.addEventListener('pagehide', () => detachFrameActors(() => true), { once: true })`
}
