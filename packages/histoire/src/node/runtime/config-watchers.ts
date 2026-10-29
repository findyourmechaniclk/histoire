import type { ProjectRuntimeDependencies } from './types.js'
import { configurationWatchInputs, watchConfiguration } from '@histoire/dev-proxy/config'
import { getConfigDependencies } from '../config/dependencies.js'

export { captureProjectConfigurationRevision } from '@histoire/dev-proxy/config'

/** SDK compatibility adapter; input discovery and watch ownership live in dev-proxy. */
export const watchProjectConfiguration: ProjectRuntimeDependencies['watch'] = async (runtime, options, restart, revision) => {
  const inputs = await configurationWatchInputs({ root: runtime.context.root, config: options.config, viteFile: runtime.viteConfigFile ?? null, revision, dependencies: getConfigDependencies(runtime.context.config) })
  const watcher = await watchConfiguration(inputs, restart, options.onError)
  return () => watcher.close()
}
