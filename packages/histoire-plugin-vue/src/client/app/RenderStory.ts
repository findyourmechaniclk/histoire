import type { Story, Variant } from '@histoire/shared'
import type {
  PropType as _PropType,
} from '@histoire/vendors/vue'
import {
  defineComponent as _defineComponent,
  h as _h,
  nextTick as _nextTick,
  onBeforeUnmount as _onBeforeUnmount,
  onMounted as _onMounted,
  ref as _ref,
  watch as _watch,
} from '@histoire/vendors/vue'
import { reactive } from 'vue'
import { createPreviewHost } from './host.js'
import { syncStateBundledAndExternal } from './util.js'

export default _defineComponent({
  name: 'RenderStory',

  props: {
    variant: {
      type: Object as _PropType<Variant>,
      required: true,
    },

    story: {
      type: Object as _PropType<Story>,
      required: true,
    },

    slotName: {
      type: String,
      default: 'default',
    },

    /**
     * No hidden mount app configures this story: the render app runs the
     * mount pass itself, so app setup (e.g. Nuxt plugins) runs once per frame.
     */
    configureStory: {
      type: Boolean,
      default: false,
    },

    /** Explicit opt-in; other renderer slots never register a provider. */
    enableInspection: {
      type: Boolean,
      default: false,
    },
  },

  emits: {
    ready: () => true,
  },

  setup(props, { emit }) {
    const sandbox = _ref<HTMLDivElement>()
    let host: ReturnType<typeof createPreviewHost>
    let mounting = false
    let inspectionEpoch = 0

    const externalState = reactive<Variant['state']>({})
    let stateSync = syncStateBundledAndExternal(props.variant.state, externalState)
    const renderContext = reactive({
      mode: 'render' as const,
      slotName: props.slotName,
      currentVariant: props.variant,
      externalState,
      nextVariantIndex: {
        value: 0,
      },
    })

    function unmountVariant() {
      inspectionEpoch++
      host?.unmount()
      host = null
    }

    function syncExternalState() {
      stateSync?.stop()
      stateSync = syncStateBundledAndExternal(props.variant.state, externalState)
    }

    async function waitForVariantStateSettled() {
      await _nextTick()
      await _nextTick()
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }

    async function mountVariant() {
      if (mounting) return
      mounting = true

      unmountVariant()
      renderContext.currentVariant = props.variant
      renderContext.slotName = props.slotName

      host = createPreviewHost({
        name: 'RenderStorySubApp',
        el: sandbox.value,
        getStory: () => props.story,
        getVariant: () => props.variant,
        renderContext,
        wrapInDiv: true,
        configureStory: props.configureStory,
        enableInspection: props.enableInspection,
      })

      await host.mount()
      // Let cross-Vue reactive mutations such as `_hPropDefs` and seeded state
      // flush back into bundled variant state before runtime snapshots readiness.
      await waitForVariantStateSettled()
      mounting = false

      emit('ready')
    }

    /** Whether the variant can mount now, or waits for the hidden mount to configure it. */
    function canMount() {
      return props.variant.configReady || props.configureStory
    }

    _onMounted(async () => {
      if (canMount()) {
        await mountVariant()
      }
    })

    _watch(() => props.variant, () => {
      renderContext.currentVariant = props.variant
      syncExternalState()
    })

    _watch(() => [props.story.id, props.slotName, props.variant.id, props.variant.configReady] as const, async ([storyId, slotName, variantId], [previousStoryId, previousSlotName, previousVariantId]) => {
      renderContext.currentVariant = props.variant
      renderContext.slotName = slotName
      const changedOwner = storyId !== previousStoryId || slotName !== previousSlotName || variantId !== previousVariantId
      const currentHost = host
      const epoch = changedOwner ? ++inspectionEpoch : inspectionEpoch
      if (changedOwner) currentHost?.invalidateInspection()

      if (canMount() && !mounting) {
        if (!host) {
          await mountVariant()
        }
        else {
          host.forceUpdate()
        }
      }
      if (changedOwner && currentHost) {
        // Do not register the successor while Vue still renders the old target.
        await _nextTick()
        if (host === currentHost && epoch === inspectionEpoch && canMount() && !mounting) currentHost.refreshInspection()
      }
    })

    _onBeforeUnmount(() => {
      stateSync?.stop()
      unmountVariant()
    })

    return {
      sandbox,
    }
  },

  render() {
    return _h('div', {
      ref: 'sandbox',
    })
  },
})
