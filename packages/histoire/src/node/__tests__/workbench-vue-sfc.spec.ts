import { readdir, readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RESOLVED_WORKBENCH_PLUGINS_ID, WORKBENCH_PLUGINS_ID } from '../virtual/index.js'
import { WORKBENCH_MODULE_MARKER } from '../vite/workbench-vue.js'
import { createWorkbenchVueProject, importUrls, VENDOR_VUE } from './utils/workbench-vue-project.js'

let project: Awaited<ReturnType<typeof createWorkbenchVueProject>>

beforeEach(async () => {
  project = await createWorkbenchVueProject()
  // A Vue story project compiling project-local plugin SFCs with its own `@vitejs/plugin-vue`.
  await project.linkExampleDependencies('vue3', ['vue', '@vitejs/plugin-vue'])
  await project.writeFiles({
    'vite.config.js': `import vue from '@vitejs/plugin-vue'\nexport default { plugins: [vue()] }\n`,
    'plugins/Panel.vue': [
      `<script setup lang="ts">`,
      `import { inject, ref } from 'vue'`,
      `const count = ref<number>(0)`,
      `const theme = inject('theme', 'none')`,
      `</script>`,
      `<template><button class="panel" @click="count++">{{ theme }} {{ count }}</button></template>`,
      `<style scoped>.panel { color: var(--histoire-accent) }</style>`,
    ].join('\n'),
    'plugins/workbench.js': `import Panel from './Panel.vue'\nexport default Panel\n`,
  })
  await project.writeConfig(`{ plugins: [{ name: 'vue-ui', workbench: { id: 'vue-ui', apiVersion: 1, client: './plugins/workbench.js' } }] }`)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await project.close()
})

describe('project-local workbench Vue SFC sources', () => {
  it('compile against the workbench Vue in dev, styles included', async () => {
    await project.withDevServer(async (get) => {
      const [entry] = importUrls(await get(RESOLVED_WORKBENCH_PLUGINS_ID))
      const panel = importUrls(await get(entry)).find(url => url.includes('Panel.vue'))!
      expect(panel).toContain(WORKBENCH_MODULE_MARKER)
      const imports = importUrls(await get(panel))
      expect(imports.find(url => url.includes('/b-vue.js'))).toBeDefined()
      expect(imports.filter(url => /\/vue\.js|node_modules\/vue\//.test(url))).toEqual([])
      // Style sub-requests stay ordinary CSS modules.
      const style = imports.find(url => url.includes('type=style'))!
      expect(style).not.toContain(WORKBENCH_MODULE_MARKER)
      expect(await get(style)).toContain('--histoire-accent')
    })
  })

  it('bundle with a single Vue runtime in static builds', async () => {
    await project.writeFiles({
      'entry.js': [
        `import { workbenchPlugins } from '${WORKBENCH_PLUGINS_ID}'`,
        `import * as appVue from ${JSON.stringify(VENDOR_VUE)}`,
        `export { workbenchPlugins, appVue }`,
      ].join('\n'),
    })
    const output = await project.buildAndImport('entry.js')
    vi.stubGlobal('__vitest_browser_runner__', { wrapDynamicImport: (load: () => Promise<unknown>) => load() })
    const panel = (await output.workbenchPlugins[0].load()).default
    expect(typeof panel.setup).toBe('function')
    const files = await readdir(project.outDir, { recursive: true })
    const code = (await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(join(project.outDir, file), 'utf8')))).join('\n')
    // Each Vue runtime copy defines its Fragment symbol once.
    expect(code.match(/Symbol\.for\("v-fgt"\)|Symbol\(\s*"v-fgt"\s*\)/g)).toHaveLength(1)
  })
})
