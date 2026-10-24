/**
 * Emits the sandbox capture components:
 * - `PreviewFrameActor` wraps one variant renderer mount and owns its frame
 *   actor slot (see `frame-actors.ts`),
 * - `PreviewTestCapture` renders the selected variant for the preview iframe,
 * - `PreviewControlsCapture` renders only the story `#controls` slot for the
 *   host Controls panel.
 *
 * Both captures mount the story off-screen first so its slots register.
 */
export function previewComponents() {
  return `const PreviewFrameActor = defineComponent({
  name: 'PreviewFrameActor',
  props: {
    story: {
      type: Object,
      required: true,
    },
    variant: {
      type: Object,
      required: true,
    },
    getElement: {
      type: Function,
      required: true,
    },
  },
  emits: {
    ready: () => true,
  },
  setup(props, { emit }) {
    // Keyed by variant: every renderer mount is a new actor, even for a variant
    // shown before in this document.
    const slot = createFrameActorSlot(() => ({ storyId: props.story.id, variantId: props.variant.id }), props.getElement)
    // Before unmount, so plugins clean up while the rendered variant still exists.
    onBeforeUnmount(() => disposeFrameActorSlot(slot))
    return () => h(GenericRenderStory, {
      story: props.story,
      variant: props.variant,
      onReady: () => emit('ready'),
    })
  },
})

const PreviewTestCapture = defineComponent({
  name: 'PreviewTestCapture',
  props: {
    story: {
      type: Object,
      required: true,
    },
    variant: {
      type: Object,
      required: true,
    },
  },
  emits: {
    ready: () => true,
  },
  setup(props, { emit }) {
    const canvas = ref(null)
    function onReady() {
      emit('ready')
    }

    return () => [
      h('div', { class: 'htw-sandbox-hidden' }, [h(GenericMountStory, {
        story: props.story,
      })]),
      h('div', {
        ref: canvas,
        class: '__histoire-preview-canvas',
        'data-histoire-variant-id': props.variant.id,
        'data-histoire-runtime-content': '',
        'data-test-id': 'sandbox-render',
      }, [h(PreviewFrameActor, {
        // Retain hidden story mount and variant state; fresh renderer must acknowledge selection.
        key: props.variant.id,
        story: props.story,
        variant: props.variant,
        getElement: () => canvas.value,
        onReady,
      })]),
    ]
  },
})

const PreviewControlsCapture = defineComponent({
  name: 'PreviewControlsCapture',
  props: {
    story: {
      type: Object,
      required: true,
    },
    variant: {
      type: Object,
      required: true,
    },
  },
  emits: {
    ready: () => true,
  },
  setup(props, { emit }) {
    const controlsBootstrapReady = ref(false)

    return () => [
      // Story must execute before its controls render. Svelte variant slots
      // depend on metadata populated by this hidden mount, and plain-object
      // metadata mutations do not retrigger an already-rendered Svelte tree.
      h('div', { class: 'htw-sandbox-hidden' }, [h(GenericMountStory, {
        story: props.story,
        onReady: () => {
          controlsBootstrapReady.value = true
        },
      })]),
      controlsBootstrapReady.value
        ? h(GenericRenderStory, {
            class: '__histoire-render-custom-controls',
            slotName: 'controls',
            story: props.story,
            variant: props.variant,
            onReady: () => emit('ready'),
          })
        : null,
    ]
  },
})`
}
