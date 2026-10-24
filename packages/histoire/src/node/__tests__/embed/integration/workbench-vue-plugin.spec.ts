import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createHistoireProject } from 'histoire/node'
import { describe, expect, it } from 'vitest'
import { resolveHistoireAppBundledDir } from '../../../util/resolve-histoire-app.js'
import { launchEmbedBrowser, trackPageReloads } from '../../utils/embed/browser.js'
import { createMcpFrameworkProject } from '../../utils/mcp/framework-project.js'

/** Precompiled npm plugin: plain JS importing `vue`, controls and plugin-kit like a published package. */
const PLUGIN_CLIENT = `
import { createApp, defineComponent, h, inject } from 'vue'
import { HstButton } from '@histoire/controls/vue'
import { defineWorkbenchPlugin } from '@histoire/plugin-kit'
import { useWorkbenchContext } from '@histoire/plugin-kit/vue'

const Pane = defineComponent({
  setup() {
    const context = useWorkbenchContext()
    return () => h(HstButton, { class: 'acme-vue-button' }, () => 'Hello ' + context.tag)
  },
})

export default defineWorkbenchPlugin({
  id: 'acme-vue',
  apiVersion: 1,
  setup(api) {
    api.shell.addPane({ id: 'pane', label: 'Acme', icon: 'plug', component: Pane })
    window.__ACME_VUE__ = { createApp, h, inject, Pane }
  },
})
`

/**
 * Runs in the workbench page once the plugin set up: proves the plugin's \`vue\` is the
 * workbench's instance (its \`inject\` reads the workbench app's provides inside the workbench
 * app context) and renders the plugin view in the workbench theme scope.
 */
const PROBE = `(() => {
  const { createApp, h, inject, Pane } = window.__ACME_VUE__
  const workbench = [...document.querySelectorAll('*')].find(element => element.__vue_app__).__vue_app__
  const provides = workbench._context.provides
  const keys = Object.getOwnPropertySymbols(provides)
  const shared = keys.length > 0 && keys.every(key => workbench.runWithContext(() => inject(key)) === provides[key])
  const target = document.createElement('div')
  document.querySelector('.histoire-app').append(target)
  const app = createApp({ render: () => h(Pane) })
  app.provide(Symbol.for('histoire.plugin-kit.workbench-view'), { context: { tag: 'workbench' }, host: {} })
  app.mount(target)
  const button = target.querySelector('button')
  const style = getComputedStyle(button)
  const result = { shared, text: button.textContent, histoireButton: button.classList.contains('histoire-button'), accent: style.getPropertyValue('--histoire-accent-rgb').trim() }
  app.unmount()
  target.remove()
  return result
})()`

/**
 * React story project without \`vue\`, plus an installed Vue workbench plugin package.
 */
async function createReactProjectWithVuePlugin() {
  const fixture = await createMcpFrameworkProject('react')
  const pluginDir = join(fixture.root, 'node_modules/acme-vue-plugin')
  await mkdir(join(pluginDir, 'node_modules/@histoire'), { recursive: true })
  await writeFile(join(pluginDir, 'package.json'), JSON.stringify({ name: 'acme-vue-plugin', type: 'module', exports: { './client': './client.js' }, peerDependencies: { vue: '^3.5.0' } }))
  await writeFile(join(pluginDir, 'client.js'), PLUGIN_CLIENT)
  // The plugin's own plugin-kit dependency, as the package manager would install it.
  const pluginKit = dirname(dirname(createRequire(join(resolveHistoireAppBundledDir(), 'index.js')).resolve('@histoire/plugin-kit')))
  await symlink(pluginKit, join(pluginDir, 'node_modules/@histoire/plugin-kit'), 'junction')
  await writeFile(join(fixture.root, 'histoire.config.ts'), `import { HstReact } from '@histoire/plugin-react'
export default { plugins: [HstReact(), { name: 'acme-vue', workbench: { id: 'acme-vue', apiVersion: 1, client: 'acme-vue-plugin/client' } }], storyMatch: ['src/Button.story.tsx'], setupFile: './src/histoire.setup.tsx', collectMaxThreads: 1, mcp: false }`)
  return fixture
}

describe('workbench Vue plugin in a React story project', () => {
  it.each(['dev', 'static'] as const)('shares the workbench Vue, controls and theme (%s)', async (mode) => {
    const fixture = await createReactProjectWithVuePlugin()
    const project = await createHistoireProject({ root: fixture.root })
    const browser = await launchEmbedBrowser()
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', (error: Error) => errors.push(error.message))
    try {
      let url: string
      if (mode === 'dev') {
        const dev = await project.startDev({ host: '127.0.0.1', port: 0 })
        await dev.ready
        url = dev.url
      }
      else {
        await project.build()
        const server = await project.preview({ host: '127.0.0.1', port: 0 })
        await server.ready
        url = server.url
      }
      const reloads = trackPageReloads(page)
      await page.goto(url)
      // Dev optimizer discoveries may reload the workbench once; probe the settled page.
      if (mode === 'dev') await reloads.settled()
      await expect.poll(() => page.evaluate('Boolean(window.__ACME_VUE__)'), { timeout: 30_000 }).toBe(true)
      expect(await page.evaluate(PROBE)).toEqual({ shared: true, text: 'Hello workbench', histoireButton: true, accent: expect.stringMatching(/\d/) })
      expect(errors).toEqual([])
    }
    finally {
      await page.close()
      await browser.close()
      await project.close()
      await fixture.close()
    }
  })
})
