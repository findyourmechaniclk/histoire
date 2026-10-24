/**
 * Emits the selection half of the preview app `setup()`: `syncSelection`, which
 * loads the host-selected story, and `markVariantReady`, which publishes real
 * readiness of a rendered actor and then attaches frame plugins to it.
 *
 * Emitted at the indentation of the app `setup()` body and spliced inside it by
 * `previewApp`; reads the setup-scoped refs declared before it.
 */
export function previewAppSelection() {
  return `    async function waitForVariantSnapshot(waitForPaint = true) {
      await nextTick()
      await nextTick()
      if (waitForPaint) await new Promise(resolve => requestAnimationFrame(resolve))
    }

    /** A mounted actor can acknowledge restored intent without remounting its story state. */
    async function markVariantReady(variantId) {
      const currentFile = file.value
      const currentSelection = previewSelectionVersion
      const targetVariant = getVariantById(variantId)
      if (!targetVariant) return
      frameworkReadyVariants.add(targetVariant)
      await waitForVariantSnapshot()
      if (file.value !== currentFile) return
      if (!selection.grid && (currentSelection !== previewSelectionVersion || variantId !== selection.variantId)) return
      getRuntimeState(targetVariant).capture()
      getRuntimePresets(targetVariant).restoreSelected()
      reapplyPropsOverride(variantId)
      readyVariantIds.add(variantId)
      postVariantStateSnapshotById(story.value, variantId)
      postToParent({ type: VARIANT_READY, storyId: story.value?.id, variantId })
      gridReadyVariantIds.add(variantId)
      runtimeLayout.refresh()
      // Frame plugins attach only after readiness is published, so a failing
      // hook cannot change it. The legacy grid sandbox never gets frame plugins.
      if (!selection.grid) {
        attachFrameActors({ storyId: story.value.id, variantId }, {
          // Same serialized projection as the VARIANT_READY state capture above.
          get: () => getRuntimeState(targetVariant).get(),
          watch: listener => watch(() => targetVariant.state, () => listener(), { deep: true }),
        })
      }
    }

    /** Loads the selected story and presentation dependencies before exposing readiness.
     * @param nextSelection Host-owned story, variant, and grid selection.
     * @returns Current selection token when applied, or null when superseded/reloading.
     */
    async function syncSelection(nextSelection) {
      const token = ++selectionToken
      const nextGrid = !!nextSelection.grid
      // Plugins of actors leaving the selection detach before anything is torn
      // down. Re-syncing the same target keeps its actor (restored readiness).
      detachFrameActors(target => nextGrid || target.storyId !== (nextSelection.storyId ?? null) || target.variantId !== (nextSelection.variantId ?? null))
      if (selection.storyId !== nextSelection.storyId || selection.variantId !== nextSelection.variantId) clearPropsOverrides()
      selection.storyId = nextSelection.storyId ?? null
      selectionState.storyId = selection.storyId
      selection.variantId = nextSelection.variantId ?? null
      // A single-story selection can leave grid mode immediately. Entering grid
      // mode waits until its component is loaded below, so Vue never renders an
      // undefined component while that import is pending.
      if (!nextGrid) selection.grid = false
      gridSelectedVariantId.value = nextSelection.variantId ?? null
      clearRuntimeTestDefinitions()
      if (!selection.storyId) {
        stopVariantStateWatchers()
        selection.grid = nextGrid
        file.value = null
        return selectionToken === token ? token : null
      }

      // Fetch story and grid modules together, but handle story collection
      // staleness separately from a failed grid chunk.
      const [fileResult, gridResult] = await Promise.allSettled([
        loadStoryFile(selection.storyId),
        nextGrid ? ensureGridComponent() : Promise.resolve(),
      ])

      if (selectionToken !== token) return null

      if (fileResult.status === 'rejected') {
        // Unknown story: the baked metadata predates the latest collection
        // (e.g. a story file added while this iframe was running).
        if (attemptStaleRuntimeReload(\`story:\${selection.storyId}\`)) {
          return null
        }
        throw fileResult.reason
      }
      if (gridResult.status === 'rejected') throw gridResult.reason

      const nextFile = fileResult.value
      selection.grid = nextGrid

      const hasUnknownVariant = selection.variantId
        && !nextFile.story.variants.some(item => item.id === selection.variantId)

      if (hasUnknownVariant) {
        // Unknown variant on a known story: same staleness, same recovery.
        if (attemptStaleRuntimeReload(\`variant:\${selection.storyId}:\${selection.variantId}\`)) {
          return null
        }
        // The reload was declined (already attempted for this selection, so
        // the variant is genuinely gone): the guard must stay armed, or the
        // next PREVIEW_SYNC would reload the whole iframe all over again.
      }
      else {
        clearStaleRuntimeReloadGuard()
      }

      file.value = nextFile
      syncVariantStateWatchers(nextFile.story)
      await nextTick()
      return selectionToken === token ? token : null
    }`
}
