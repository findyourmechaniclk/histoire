import { isModuleLoadFailure } from '@histoire/shared'

/**
 * Vue error handler of the standalone workbench. A lazy workbench chunk that
 * failed to fetch (e.g. on a network change) leaves part of the UI missing, so
 * the document reloads under its entry guard (`__histoireEntryFailed`, inlined
 * in the dev workbench HTML) instead; other errors are logged as before.
 * @param window Window owning the workbench document.
 */
export function createWorkbenchErrorHandler(window: Window & { __histoireEntryFailed?: () => boolean }) {
  return (error: unknown): void => {
    if (isModuleLoadFailure(error) && window.__histoireEntryFailed?.()) return
    console.error(error)
  }
}
