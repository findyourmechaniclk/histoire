import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RESOLVED_WORKBENCH_PLUGINS_ID, WORKBENCH_PLUGINS_ID } from '../virtual/index.js'
import { WORKBENCH_MODULE_MARKER } from '../vite/workbench-vue.js'
import { APP_CONTROLS, APP_MODULE, createWorkbenchVueProject, importUrls, VENDOR_VUE } from './utils/workbench-vue-project.js'

let project: Awaited<ReturnType<typeof createWorkbenchVueProject>>

beforeEach(async () => {
  project = await createWorkbenchVueProject()
  // Precompiled plugin code, as an npm plugin ships it.
  await project.writeFiles({
    // One module reached from both the plugin graph and story code.
    'plugins/shared.js': `import * as vue from 'vue'\nexport default vue\n`,
    'plugins/workbench.js': [
      `import * as vue from 'vue'`,
      `import * as runtime from '@vue/runtime-core'`,
      `import { HstButton } from '@histoire/controls/vue'`,
      `import { useWorkbenchContext } from '@histoire/plugin-kit/vue'`,
      `import shared from './shared.js'`,
      `import widgets from 'vue-widgets'`,
      `export default { vue, runtime, HstButton, shared, useWorkbenchContext, widgets }`,
    ].join('\n'),
    // Third-party Vue library: declares `vue`, hides its manifest behind `exports`.
    'node_modules/vue-widgets/package.json': JSON.stringify({ name: 'vue-widgets', type: 'module', exports: { '.': './dist/index.js' }, peerDependencies: { vue: '^3.5.0' } }),
    'node_modules/vue-widgets/dist/index.js': `import * as vue from 'vue'\nexport default vue\n`,
    'story-side.js': `import shared from './plugins/shared.js'\nexport default shared\n`,
  })
  await project.writeConfig(`{ plugins: [{ name: 'vue-ui', workbench: { id: 'vue-ui', apiVersion: 1, client: './plugins/workbench.js' } }] }`)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await project.close()
})

/** Installs a stand-in project `vue`, as a Vue story project has. */
async function installProjectVue() {
  await project.writeFiles({
    'node_modules/vue/package.json': JSON.stringify({ name: 'vue', type: 'module', exports: './index.js' }),
    'node_modules/vue/index.js': 'export const projectVue = true\n',
  })
}

describe('workbench Vue resolution in dev', () => {
  it.each([
    { name: 'Vue story project', projectVue: true },
    { name: 'project without vue', projectVue: false },
  ])('gives plugin modules the workbench Vue and controls ($name)', async ({ projectVue }) => {
    if (projectVue) await installProjectVue()
    await project.withDevServer(async (get) => {
      const app = importUrls(await get(`/@fs${APP_MODULE}`))
      const appVue = app.find(url => url.includes('/b-vue.js'))
      expect(appVue).toBeDefined()

      const [entry] = importUrls(await get(RESOLVED_WORKBENCH_PLUGINS_ID))
      expect(entry).toContain(WORKBENCH_MODULE_MARKER)
      const plugin = importUrls(await get(entry))
      // `vue` and `@vue/runtime-core` both land on the exact URL the workbench loads.
      expect(plugin.filter(url => url === appVue)).toHaveLength(2)
      // Controls come from the app entry, which only re-exports the workbench's controls chunk.
      const pluginControls = plugin.find(url => url.split('?')[0].endsWith(APP_CONTROLS))
      expect(pluginControls).toBeDefined()
      expect(importUrls(await get(pluginControls!)).map(url => url.split('?')[0])).toEqual([`/@fs${APP_MODULE}`])

      const shared = plugin.find(url => url.includes('plugins/shared.js'))!
      expect(shared).toContain(WORKBENCH_MODULE_MARKER)
      expect(importUrls(await get(shared))).toEqual([appVue])
      for (const name of ['plugin-kit', 'vue-widgets']) {
        const library = plugin.find(url => url.includes(name))!
        expect(library).toContain(WORKBENCH_MODULE_MARKER)
        expect(importUrls(await get(library))).toContain(appVue)
      }

      if (projectVue) {
        // Story code reaching the same file keeps the project's own Vue.
        const storyShared = importUrls(await get('/story-side.js'))[0]
        expect(storyShared).not.toContain(WORKBENCH_MODULE_MARKER)
        expect(importUrls(await get(storyShared))).not.toContain(appVue)
      }
    })
  })

  it('rejects Vue subpaths the runtime-only workbench Vue cannot provide', async () => {
    await project.writeFiles({ 'plugins/workbench.js': `import { renderToString } from 'vue/server-renderer'\nexport default renderToString\n` })
    await project.withDevServer(async (get) => {
      const [entry] = importUrls(await get(RESOLVED_WORKBENCH_PLUGINS_ID))
      await expect(get(entry)).rejects.toThrow(/vue\/server-renderer[\s\S]*runtime-only/)
    })
  })

  it('prebundles CommonJS dependencies of installed plugin packages', async () => {
    // Installed like an npm plugin with React views: Vite never optimizes imports made from
    // node_modules files, so `react`-style CommonJS would otherwise be served raw.
    await project.writeFiles({
      'node_modules/acme-ui/package.json': JSON.stringify({ name: 'acme-ui', type: 'module', exports: { './client': './client.js' }, peerDependencies: { vue: '^3.5.0' }, dependencies: { 'cjs-lib': '1.0.0' } }),
      'node_modules/acme-ui/client.js': `import { value } from 'cjs-lib'\nexport default { value }\n`,
      'node_modules/acme-ui/node_modules/cjs-lib/package.json': JSON.stringify({ name: 'cjs-lib', main: 'index.js' }),
      'node_modules/acme-ui/node_modules/cjs-lib/index.js': `exports.value = 42\n`,
    })
    await project.writeConfig(`{ plugins: [{ name: 'acme-ui', workbench: { id: 'acme-ui', apiVersion: 1, client: 'acme-ui/client' } }] }`)
    await project.withDevServer(async (get) => {
      const [entry] = importUrls(await get(RESOLVED_WORKBENCH_PLUGINS_ID))
      const [dependency] = importUrls(await get(entry))
      // Optimized id in the dev cache directory, not the raw package file.
      expect(dependency).toMatch(/\/deps\/cjs-lib\.js\?v=/)
    })
  })

  it('keeps plugin Vue dependencies out of the optimizer scan in projects without vue', async () => {
    await project.writeFiles({ 'scan-entry.js': `import '${WORKBENCH_PLUGINS_ID}'\n` })
    await project.withDevServer(async (get, server) => {
      const optimizer = server.environments.client.depsOptimizer!
      await optimizer.scanProcessing
      // A registered `vue` or `@histoire/plugin-kit/vue` would fail the prebundle here.
      expect(Object.keys(optimizer.metadata.discovered)).not.toContain('vue')
      expect(Object.keys(optimizer.metadata.discovered).filter(id => /plugin-kit|vue-widgets/.test(id))).toEqual([])
      const [entry] = importUrls(await get(RESOLVED_WORKBENCH_PLUGINS_ID))
      expect(importUrls(await get(entry)).some(url => url.includes('/b-vue.js'))).toBe(true)
    }, { optimizeDeps: { entries: ['scan-entry.js'] } })
  })
})

describe('workbench Vue resolution in static builds', () => {
  it('bundles plugin modules against the workbench Vue only', async () => {
    await installProjectVue()
    await project.writeFiles({
      'entry.js': [
        `import { workbenchPlugins } from '${WORKBENCH_PLUGINS_ID}'`,
        `import * as appVue from ${JSON.stringify(VENDOR_VUE)}`,
        `import storySide from './story-side.js'`,
        `export { workbenchPlugins, appVue, storySide }`,
      ].join('\n'),
    })
    const output = await project.buildAndImport('entry.js')
    // Project Vitest mocker wraps build dynamic imports; browser runtimes install the runner.
    vi.stubGlobal('__vitest_browser_runner__', { wrapDynamicImport: (load: () => Promise<unknown>) => load() })
    const plugin = (await output.workbenchPlugins[0].load()).default
    expect(plugin.vue.ref).toBe(output.appVue.ref)
    expect(plugin.runtime.ref).toBe(output.appVue.ref)
    expect(plugin.shared.ref).toBe(output.appVue.ref)
    expect(plugin.widgets.ref).toBe(output.appVue.ref)
    expect(output.storySide).toMatchObject({ projectVue: true })
  })
})
