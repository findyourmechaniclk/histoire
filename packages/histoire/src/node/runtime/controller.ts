import type { ProjectRuntimeDependencies, ProjectRuntimeOptions } from './types.js'
import { createRestartCoordinator } from '@histoire/dev-proxy/lifecycle'
import { hasUnconfirmedCleanup, withCleanupDeadline } from './cleanup.js'
import { watchProjectConfiguration } from './config-watchers.js'
import { startProjectRuntime } from './start.js'

/** SDK/MCP compatibility adapter; restart scheduling belongs to dev-proxy package. */
export function createProjectRuntimeController(options: ProjectRuntimeOptions = {}, dependencies: Partial<ProjectRuntimeDependencies> = {}) {
  return createRestartCoordinator({
    acquire: (signal, active) => (dependencies.start ?? startProjectRuntime)(options, signal, active),
    watch: (runtime, restart) => (dependencies.watch ?? watchProjectConfiguration)(runtime, options, restart, runtime.configurationRevision),
    onGeneration: options.onGeneration,
    onBeforeRelease: options.onBeforeRelease,
    onError: options.onError,
    isUnsafeCleanup: hasUnconfirmedCleanup,
    withDeadline: withCleanupDeadline,
  })
}

/** One CLI child runs once; config watching and replacement belong to its parent. */
export function createSingleRunProjectRuntimeController(options: ProjectRuntimeOptions = {}) {
  return createRestartCoordinator({
    acquire: (signal, active) => startProjectRuntime(options, signal, active),
    onGeneration: options.onGeneration,
    onBeforeRelease: options.onBeforeRelease,
    onError: options.onError,
    isUnsafeCleanup: hasUnconfirmedCleanup,
    withDeadline: withCleanupDeadline,
  })
}
