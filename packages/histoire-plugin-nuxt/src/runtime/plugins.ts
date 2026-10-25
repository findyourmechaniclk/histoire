/** Nuxt plugins that only make sense in a real Nuxt page, by `defineNuxtPlugin` name. */
const pagePlugins = [
  // Warns because stories never render `<NuxtLayout>`.
  'nuxt:checkIfLayoutUsed',
]

/**
 * Nuxt plugins skipped while collecting stories in Node. Collection compiles
 * Vapor SFCs as VDOM, and Vue's Node build has no `vaporInteropPlugin`.
 */
const collectPlugins = [
  'nuxt:vapor-interop',
]

/** Removes the Nuxt plugins a story app must not run. */
export function selectStoryPlugins<T extends { _name?: string }>(plugins: T[], collecting: boolean): T[] {
  return plugins.filter(plugin => !pagePlugins.includes(plugin._name) && !(collecting && collectPlugins.includes(plugin._name)))
}

/**
 * The Vue story host registers a `RouterLink` stub, and Nuxt's router plugin
 * registers its own, which wins anyway. Unregister the stub first so Vue
 * doesn't warn about the duplicate registration.
 */
export function releaseRouterLink(app: { _context: { components: Record<string, unknown> } }) {
  delete app._context.components.RouterLink
}
