import { previewAppSelection } from './app-selection.js'
import { previewMessageHandler } from './message-handler.js'
import { previewPropsOverride } from './props-override.js'
import { previewRuntimeService } from './runtime-service.js'

/**
 * Emits the preview Vue app: the `setup()` that owns the current selection,
 * loads the story file, keeps the per-variant state watchers in sync with the
 * host, and the `render()` that picks between single-variant and controls-only
 * modes.
 *
 * Selection loading and readiness ({@link previewAppSelection}), runtime
 * services and the inbound message dispatch ({@link previewMessageHandler}) are
 * spliced into the middle of `setup()`.
 */
export function previewApp() {
  return `const app = createApp({
  name: 'VitestPreviewRuntime',
  setup() {
    const file = ref(null)
    const selection = reactive({ storyId: null, variantId: null })
    let mounted = false
    let selectionToken = 0
    const readyVariantIds = new Set()
    // Framework readiness precedes delayed state serialization; reload resync can span that wait.
    const frameworkReadyVariants = new WeakSet()
    const variantStateGuards = createVariantStateSyncGuards()
    const controlsRevision = createControlsStateRevision()
    const variantStateWatchStops = new Map()
    const story = computed(() => file.value?.story ?? null)
    const variant = computed(() => story.value?.variants.find(item => item.id === selection.variantId) ?? null)

    function getVariantById(variantId) {
      return story.value?.variants.find(item => item.id === variantId) ?? null
    }

    function stopVariantStateWatchers() {
      for (const stop of variantStateWatchStops.values()) {
        stop()
      }

      readyVariantIds.clear()
      variantStateWatchStops.clear()
      variantStateGuards.reset()
    }

    function syncVariantStateWatchers(nextStory) {
      stopVariantStateWatchers()

      if (!nextStory) {
        return
      }

      for (const targetVariant of nextStory.variants) {
        const key = getVariantStateKey(nextStory.id, targetVariant.id)
        if (!key) {
          continue
        }

        const stop = watch(() => targetVariant.state, value => {
          // Consume BEFORE the ready gate: the host syncs state while the
          // variant is still pending, and returning early here would leave
          // that suppression armed — swallowing the first genuine in-story
          // mutation after ready (the Controls panel would miss it).
          if (variantStateGuards.consume(key)) {
            return
          }

          if (!readyVariantIds.has(targetVariant.id)) {
            return
          }
          if (initialSelection.matrix) return

          postToParent({
            type: STATE_SYNC,
            storyId: nextStory.id,
            variantId: targetVariant.id,
            state: toRawDeep(value, true),
            ...(initialSelection.controls ? { controlsRevision: controlsRevision.capture() } : {}),
          })
        }, {
          // Default (batched) flush so all key mutations of one applyState coalesce
          // into a single watcher firing that the single suppress/consume pairs with.
          // A sync flush would fire once per mutated key, leaking partial-state echoes.
          deep: true,
        })

        variantStateWatchStops.set(key, stop)
      }
    }

${previewAppSelection()}

${previewRuntimeService()}

${previewPropsOverride()}

${previewMessageHandler()}

    onMounted(() => {
      mounted = true
      if (initialSelection.storyId) {
        // Wait for the initial selection to load before announcing readiness so
        // the host receives the resolved variantId, not a stale null.
        void syncSelection(initialSelection).then((syncedToken) => {
          if (syncedToken === null || syncedToken !== selectionToken) return
          postToParent({ type: SANDBOX_READY, storyId: story.value?.id, variantId: variant.value?.id })
        }).catch(error => { renderRuntimeError(error) })
      }
      else {
        postToParent({ type: SANDBOX_READY, storyId: story.value?.id, variantId: variant.value?.id })
      }
    })

    return {
      file,
      story,
      variant,
      selection,
      markVariantReady,
      async markControlsReady(variantId) {
        // Controls can start below their panel viewport. Waiting for paint
        // deadlocks offscreen iframes whose animation frames are suspended.
        await waitForVariantSnapshot(false)
        // Enable outbound edit sync WITHOUT pushing the boot state snapshot:
        // This controls replica never publishes boot defaults: primary preview
        // runtime owns state. Host relays its latest serializable mirror after
        // both runtimes report ready.
        readyVariantIds.add(variantId)
        const activeVariant = getVariantById(variantId)
        const hasControls = Boolean(
          activeVariant?.slots?.().controls || story.value?.slots?.().controls,
        )
        postToParent({ type: CONTROLS_READY, storyId: story.value?.id, variantId, hasControls })
        observeControlsResize()
      },
    }
  },
  render() {
    const renderedVariantId = this.variant?.id
    if (!this.story) {
      return null
    }

    if (initialSelection.controls) {
      return this.variant
        ? h(PreviewControlsCapture, {
          key: \`\${this.story.id}:\${this.variant.id}\`,
          story: this.story,
          variant: this.variant,
          onReady: () => this.markControlsReady(this.variant.id),
        })
        : null
    }

    return this.variant
      ? h(PreviewTestCapture, {
        story: this.story,
        variant: this.variant,
        onReady: () => this.markVariantReady(renderedVariantId),
      })
      : null
  },
})`
}
