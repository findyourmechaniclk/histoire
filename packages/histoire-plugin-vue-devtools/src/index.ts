import type { Plugin } from '@histoire/shared'
import { fileURLToPath } from 'node:url'
import { sandboxDevtools } from './sandbox.js'

/** Options for the development-only Vue DevTools integration. */
export interface VueDevtoolsOptions {
  /** Enable the integration; defaults to true. */
  enabled?: boolean
  /** Pre-approved local token. Only use with a loopback-only development server. */
  clientAuthToken?: string
}

/** Install Devframe-based Vue DevTools for interactive Histoire story frames. */
export function HstVueDevtools(options: VueDevtoolsOptions = {}): Plugin {
  const token = options.clientAuthToken
  if (token !== undefined && (token.length < 32 || token.length > 512 || [...token].some(character => character.charCodeAt(0) < 33 || character.charCodeAt(0) > 126))) throw new Error('Invalid Vue DevTools token')
  return {
    name: '@histoire/plugin-vue-devtools',
    metadata: { displayName: 'Vue DevTools', description: 'Vue DevTools for story frames', icon: 'logo-vue', docsUrl: 'https://histoire.dev/guide/devframe.html', repoUrl: 'https://github.com/histoire-dev/histoire/tree/main/packages/histoire-plugin-vue-devtools' },
    workbench: options.enabled === false
      ? undefined
      : {
          id: 'vue-devtools',
          apiVersion: 1,
          client: fileURLToPath(new URL('./workbench.js', import.meta.url)),
          frame: fileURLToPath(new URL('./frame.js', import.meta.url)),
          devOnly: true,
        },
    async viteConfig(config, context) {
      if (options.enabled === false || context.mode !== 'dev' || context.isServer || context.browserRuntime || context.collecting || config.devtools === false) return
      const vueDevTools = (await import('vite-plugin-vue-devtools')).default
      const current = typeof config.devtools === 'object' ? config.devtools : {}
      return {
        define: { __HISTOIRE_VUE_DEVTOOLS_ACTIVE__: true },
        devtools: {
          ...current,
          apply: 'serve',
          host: '127.0.0.1',
          mcp: false,
          ...(token ? { clientAuthTokens: [...(current.clientAuthTokens ?? []), token] } : {}),
        },
        ...(token ? { server: { host: '127.0.0.1', hmr: { host: '127.0.0.1' } } } : {}),
        plugins: [vueDevTools(), sandboxDevtools(token)],
      }
    },
  }
}
