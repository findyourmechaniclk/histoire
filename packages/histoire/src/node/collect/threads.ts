import type { ConfigMode } from '@histoire/shared'

/**
 * Default dev worker count. Workers spend most of the first story waiting for
 * the main thread to transform the app graph (vite-node `fetchModule`), and
 * each one evaluates that whole graph: with a Nuxt app, 4 workers collect as
 * fast as 16 with a third less CPU.
 */
const DEV_DEFAULT_THREADS = 4

/**
 * Number of story collection workers.
 * @param mode Dev keeps half the cores for the dev server and browser; builds use all but one.
 * @param cpuCount Available cores.
 * @param maxThreads `collectMaxThreads` from the config.
 */
export function getCollectThreadCount(mode: ConfigMode, cpuCount: number, maxThreads?: number): number {
  if (mode === 'dev') return Math.max(Math.min(maxThreads ?? DEV_DEFAULT_THREADS, Math.floor(cpuCount / 2)), 1)
  return Math.max(Math.min(maxThreads ?? cpuCount, cpuCount - 1), 1)
}
