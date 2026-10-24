import type { Story, Variant } from '@histoire/shared'
import type { App, Component } from 'vue'

/** Options for scoping a setup wrapper to story or custom-controls rendering. */
export interface Vue3StoryWrapperOptions {
  /** Include custom controls inside this wrapper. Defaults to `true`. */
  controls?: boolean
}

/** Callback run at a mount stage of an isolated story app. */
export type Vue3AppHookCallback = () => Promise<void> | void

/** Wraps later setup functions, e.g. to install a framework context. */
export type Vue3AppContextRunner = <T>(callback: () => T | Promise<T>) => T | Promise<T>

/**
 * Lifecycle hooks of one isolated story app, for framework integrations
 * (Nuxt, Quasar, ...) and user setup code.
 */
export interface Vue3AppHooksApi {
  /** Runs after all setup hooks, right before the app mounts. */
  onBeforeMount: (callback: Vue3AppHookCallback) => void
  /** Runs once the root Suspense resolved after mounting. */
  onMounted: (callback: Vue3AppHookCallback) => void
  /** Runs after `onMounted` callbacks, before the story reports readiness. */
  onReady: (callback: Vue3AppHookCallback) => void
  /**
   * Runs once when the app is retired, including when setup fails before mount.
   * Callbacks registered after retirement run when the host releases the retired app.
   */
  onCleanup: (callback: () => void) => void
  /**
   * Wraps later setup hooks (user setup file, `setupApp`) with a framework context.
   * Runners compose: the newest one runs innermost (previous runners wrap it).
   */
  setRunWithContext: (runner: Vue3AppContextRunner) => void
}

export interface Vue3StorySetupApi {
  /** Reactive globals for this isolated story document. */
  globals?: import('@histoire/shared').HistoireGlobals
  app: App
  story?: Story
  variant?: Variant
  /** Register wrapper; opt out of the custom-controls surface for visual-only wrappers. */
  addWrapper: (wrapper: Component, options?: Vue3StoryWrapperOptions) => void
  /** Lifecycle hooks of this story app. */
  hooks: Vue3AppHooksApi
  /**
   * Calls `listener` with Histoire's current dark mode, then on every change,
   * until the story app is retired. Use it to sync a UI library theme.
   */
  onDarkChange: (listener: (dark: boolean) => void) => void
}

export type Vue3StorySetupHandler = (api: Vue3StorySetupApi) => Promise<void> | void

export function defineSetupVue3(handler: Vue3StorySetupHandler): Vue3StorySetupHandler {
  return handler
}
