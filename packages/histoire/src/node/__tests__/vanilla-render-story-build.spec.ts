import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const renderStory = fileURLToPath(new URL('../builtin-plugins/vanilla-support/RenderStory.ts', import.meta.url))
const setupIds = ['virtual:$histoire-setup', 'virtual:$histoire-generated-global-setup']

describe('vanilla RenderStory build', () => {
  it('bundles against setup files without `setupVanilla` without warnings', async () => {
    const warnings: string[] = []
    await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        write: false,
        lib: { entry: renderStory, formats: ['es'], fileName: 'render-story' },
        rollupOptions: {
          // Only this module and the setup files matter here.
          external: id => !id.startsWith('virtual:') && id !== renderStory,
          onwarn: warning => void warnings.push(`${warning.code}: ${warning.message}`),
        },
      },
      plugins: [{
        name: 'vue-only-setup',
        resolveId: id => setupIds.includes(id) ? id : undefined,
        // A Vue-only project: its setup file has no vanilla hook.
        load: id => setupIds.includes(id) ? 'export function setupVue3() {}' : undefined,
      }],
    })
    expect(warnings.filter(warning => warning.includes('IMPORT_IS_UNDEFINED'))).toEqual([])
  })
})
