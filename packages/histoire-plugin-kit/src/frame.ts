// Frame entry: evaluated inside interactive story frames; keep it free of workbench and framework code.
export { defineFramePlugin, PLUGIN_API_VERSION } from './define.js'
export { PluginDefinitionError } from './errors.js'
export type { PluginChannel, PluginChannelMessage } from './types/channel.js'
export type { Awaitable, Disposer } from './types/common.js'
export type { FramePluginContext, FramePluginDefinition, ReadonlyFrameState } from './types/frame.js'
