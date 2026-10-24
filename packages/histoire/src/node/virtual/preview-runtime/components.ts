/**
 * Emits the two sandbox capture components:
 * - `PreviewTestCapture` renders the selected variant for the preview iframe,
 * - `PreviewControlsCapture` renders only the story `#controls` slot for the
 *   host Controls panel.
 *
 * Both mount the story off-screen first so its slots register. The test
 * capture leaves that to the support plugin's RenderStory when it can.
 */
export function previewComponents() {
  return `const PreviewTestCapture = defineComponent({
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
    function onReady() {
      emit('ready')
    }

    return () => [
      // Skipped for support plugins whose RenderStory configures the story
      // in its own app (one app setup per frame instead of two).
      h('div', { class: 'htw-sandbox-hidden' }, [h(GenericMountStory, {
        story: props.story,
        optional: true,
      })]),
      h('div', {
        class: '__histoire-preview-canvas',
        'data-histoire-variant-id': props.variant.id,
        'data-histoire-runtime-content': '',
        'data-test-id': 'sandbox-render',
      }, [h(GenericRenderStory, {
        // Retain hidden story mount and variant state; fresh renderer must acknowledge selection.
        key: props.variant.id,
        story: props.story,
        variant: props.variant,
        configureStory: true,
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
