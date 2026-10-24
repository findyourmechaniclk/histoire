import { isDark as _isDark } from './util/dark.js'

export { toggleDark } from './util/dark.js'

export { logEvent } from './util/events.js'
export { useHostChannel } from './util/host-channel.js'
export type { HistoireStoryHostChannel } from './util/host-channel.js'
export { useHistoireGlobals, useHistoireGlobalsStore } from '@histoire/shared'
/** Follow Histoire's dark mode from any story framework, e.g. to sync a UI library theme. */
export { onHistoireDarkChange as onDarkChange } from '@histoire/shared'

export function isDark() {
  return _isDark.value
}
