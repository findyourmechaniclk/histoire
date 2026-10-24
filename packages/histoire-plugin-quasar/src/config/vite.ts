import type { PluginOption, UserConfig } from 'vite'

/** Quasar CLI plugins that only make sense for its own dev server or build. */
const ignoredPlugins = [
  'quasar:html',
  'quasar:strip-filename-hashes',
  // Type checking/linting belongs to the app's own dev server and CI.
  'vite-plugin-checker',
]

/** Plugin name, for any (possibly falsy) plugin option. */
function pluginName(plugin: PluginOption): string | undefined {
  return plugin && typeof plugin === 'object' && 'name' in plugin ? plugin.name : undefined
}

/** Flatten nested plugin arrays, dropping falsy entries and CLI-only plugins. */
function filterPlugins(plugins: PluginOption[] = []): PluginOption[] {
  return (plugins.flat(Infinity as 1) as PluginOption[]).filter((plugin) => {
    const name = pluginName(plugin)
    return plugin && !ignoredPlugins.includes(name) && !/devtools|inspect/.test(name ?? '')
  })
}

/**
 * Keep the parts of Quasar CLI's resolved Vite config that compile the app
 * (plugins, aliases, defines, CSS), and drop root/server/output/cache settings
 * Histoire owns.
 */
export function toHistoireViteConfig(viteConfig: UserConfig): UserConfig {
  const { optimizeDeps, build } = viteConfig
  // `entries` points to Quasar's index.html; Histoire scans its own entries.
  const { entries: _entries, ...histoireOptimizeDeps } = optimizeDeps ?? {}
  return {
    publicDir: viteConfig.publicDir,
    define: viteConfig.define,
    resolve: viteConfig.resolve,
    css: viteConfig.css,
    // Vue JSX runtime selection, when the project enables JSX.
    ...'oxc' in viteConfig ? { oxc: viteConfig.oxc } : {},
    build: { target: build?.target },
    optimizeDeps: histoireOptimizeDeps,
    plugins: filterPlugins(viteConfig.plugins),
  }
}
