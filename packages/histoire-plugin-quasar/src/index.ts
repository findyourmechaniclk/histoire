import type { Plugin } from 'histoire'
import { resolveQuasarProject } from './config/resolve.js'
import { generateSetupCode } from './config/setup-code.js'
import { toHistoireViteConfig } from './config/vite.js'

/** Integrates a Quasar CLI (Vite) project: config, styles, plugins, boot files and App Extensions. */
export function HstQuasar(): Plugin {
  return {
    name: '@histoire/plugin-quasar',

    /** Quasar project Vite config, setup code and collection inline deps. */
    async defaultConfig(_config, mode, context) {
      const { viteConfig, config } = await resolveQuasarProject(context?.root ?? process.cwd(), mode !== 'build')
      const vite = toHistoireViteConfig(viteConfig)
      return {
        vite: {
          ...vite,
          optimizeDeps: {
            ...vite.optimizeDeps,
            // Runtime imported by generated setup code: serve it as is, like other Histoire plugins.
            exclude: [...vite.optimizeDeps?.exclude ?? [], '@histoire/plugin-quasar'],
          },
        },
        setupCode: [generateSetupCode(config)],
        // `quasar` itself is inlined by @histoire/plugin-vue; extras ship CSS.
        viteNodeInlineDeps: [/[/\\]node_modules[/\\]@quasar[/\\]extras[/\\]/],
      }
    },
  }
}
