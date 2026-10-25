import './util/vitest-mocker-shim.js'

export { observeRuntimeLayout } from '../embed/adapters/layout.js'
export { createRuntimeStatePresets } from '../embed/adapters/state-presets.js'
export { createRuntimeState } from '../embed/adapters/state.js'
/** Shared app surface consumed by generated sandboxes and test mounts. */
export { default as GenericMountStory } from './components/story/GenericMountStory.vue'
export { default as GenericRenderStory } from './components/story/GenericRenderStory.vue'
export { setupPluginApi } from './plugin.js'
export { createStandalonePresetStorage } from './standalone/presets.js'
export { usePreviewSettingsStore } from './stores/preview-settings.js'
export { histoireConfig } from './util/config.js'
export * from './util/const.js'
export { setupControlsDocument } from './util/controls-document.js'
export { isDark } from './util/dark.js'
export { getDynamicSourceCode } from './util/docs.js'
export { installRuntimeHostChannels } from './util/host-channel.js'
export { applyPreviewSettings } from './util/preview-settings.js'
export { installRuntimeEventScope } from './util/runtime-events.js'
export { toRawDeep } from './util/state.js'

/** Defer grid-only components until a sandbox selects the grid layout. */
export function loadStoryVariantGridSandbox() {
  return import('./components/story/StoryVariantGridSandbox.vue')
}
