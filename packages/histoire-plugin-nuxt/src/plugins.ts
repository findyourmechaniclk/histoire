/** Matches a Nuxt plugin by a fragment of its file path, or by a pattern tested against that path. */
export type NuxtPluginPattern = string | RegExp

/**
 * Drops the app plugins matching one of `patterns` (Nuxt `app:resolve` hook).
 * Paths are compared with forward slashes, whatever the platform.
 */
export function excludeAppPlugins<T extends { src: string }>(plugins: T[], patterns: NuxtPluginPattern[]): T[] {
  if (!patterns.length) return plugins
  return plugins.filter((plugin) => {
    const src = plugin.src.replace(/\\/g, '/')
    return !patterns.some(pattern => typeof pattern === 'string' ? src.includes(pattern) : pattern.test(src))
  })
}
