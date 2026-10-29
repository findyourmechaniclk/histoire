import type { Plugin } from '@histoire/shared'
import { fileURLToPath } from 'node:url'
import { dirname } from 'pathe'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function vanillaSupport(): Plugin {
  return {
    name: 'builtin:vanilla-support',
    metadata: { displayName: 'Vanilla', icon: 'logo-javascript', description: 'JavaScript story support', docsUrl: 'https://histoire.dev/guide/getting-started.html' },

    defaultConfig() {
      return {
        supportMatch: [
          {
            id: 'vanilla',
            patterns: ['**/*.js'],
            pluginIds: ['vanilla'],
          },
        ],
      }
    },

    supportPlugin: {
      id: 'vanilla',
      moduleName: __dirname,
      setupFn: 'setupVanilla',
      importStoryComponent: (file, index) => `import Comp${index} from ${JSON.stringify(file.moduleId)}`, // @TODO code-splitting
    },

    // onDev (api) {
    //   // Test vanilla story
    //   api.addStoryFile(resolve(__dirname, './vanilla.story.js'))
    // },
  }
}
