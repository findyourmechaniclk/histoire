import type { AddressInfo } from 'node:net'
import { readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { join, normalize } from 'pathe'
import { build, createServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeContext, createContext } from '../context.js'
import { COMMANDS, CONFIG_ID, FRAME_PLUGINS_ID, RESOLVED_COMMANDS, RESOLVED_WORKBENCH_PLUGINS_ID, WORKBENCH_PLUGINS_ID } from '../virtual/index.js'
import { createVirtualFilesPlugin } from '../virtual/vite-plugin.js'
import { getViteConfigWithPlugins } from '../vite/index.js'
import { createWorkbenchPluginProject, WORKBENCH_FIXTURE_MARKERS as MARKERS, WORKBENCH_FIXTURE_CONFIG } from './utils/workbench-plugin-project.js'

let project: Awaited<ReturnType<typeof createWorkbenchPluginProject>>

beforeEach(async () => {
  project = await createWorkbenchPluginProject()
  await project.writeConfig(WORKBENCH_FIXTURE_CONFIG)
})

afterEach(async () => {
  await project.close()
})

/**
 * Lists `import("...")` specifiers of a served or generated module.
 * @param code Module code.
 */
function dynamicImports(code: string) {
  return [...code.matchAll(/import\("([^"]+)"\)/g)].map(match => match[1])
}

describe('workbench plugin manifests', () => {
  it('are served by the dev server with loadable entries and no Node-only plugin data', async () => {
    const ctx = await createContext({ root: project.root, mode: 'dev' })
    const { viteConfig } = await getViteConfigWithPlugins(false, ctx)
    const server = await createServer({ ...viteConfig, configFile: false, logLevel: 'silent', server: { ...viteConfig.server, port: 0, hmr: false, watch: null } })
    try {
      await server.listen()
      const origin = `http://localhost:${(server.httpServer!.address() as AddressInfo).port}`
      /** Fetches one served module as the browser would. */
      const get = async (path: string) => {
        const response = await fetch(new URL(path, origin))
        return { status: response.status, text: await response.text() }
      }

      const manifest = await get(RESOLVED_WORKBENCH_PLUGINS_ID)
      expect(manifest.status).toBe(200)
      const entries = dynamicImports(manifest.text)
      // Config order; dev-only entries stay in development.
      expect(entries).toHaveLength(2)
      const packageClient = await get(entries[0])
      expect(packageClient).toMatchObject({ status: 200, text: expect.stringContaining(MARKERS.packageClient) })
      // The package lives outside the project root: serving its asset proves `server.fs.allow`.
      const packageDir = normalize(await realpath(project.packageDir)).replace(/^\//, '')
      expect((await get(`/@fs/${packageDir}/icon.svg`)).status).toBe(200)
      expect((await get(entries[1])).text).toContain(MARKERS.devOnly)

      const commands = await get(RESOLVED_COMMANDS)
      const commandImport = commands.text.match(/import \w+ from "([^"]+)"/)?.[1]
      expect(commandImport).toBeDefined()
      expect((await get(commandImport!)).text).toContain(MARKERS.command)

      const config = await get(`/@id/__x00__${CONFIG_ID}`)
      expect(config.status).toBe(200)
      expect(config.text).not.toContain(MARKERS.nodeOnly)
      expect(manifest.text).not.toContain(MARKERS.nodeOnly)
    }
    finally {
      await server.close()
      await closeContext(ctx)
    }
  })

  it('bundle configured non-dev-only entries into static builds', async () => {
    const ctx = await createContext({ root: project.root, mode: 'build' })
    const outDir = join(project.root, 'dist')
    // Minimal consumer of the public virtual modules; the app wiring belongs to the workbench.
    await writeFile(join(project.root, 'entry.js'), [
      `import { workbenchPlugins } from '${WORKBENCH_PLUGINS_ID}'`,
      `import { framePlugins } from '${FRAME_PLUGINS_ID}'`,
      `import { config } from '${CONFIG_ID}'`,
      `import { registeredCommands } from '${COMMANDS}'`,
      `globalThis.out = [config, registeredCommands, ...[...workbenchPlugins, ...framePlugins].map(plugin => [plugin.id, plugin.options, plugin.load()])]`,
    ].join('\n'))
    try {
      await build({
        root: project.root,
        configFile: false,
        logLevel: 'silent',
        plugins: [createVirtualFilesPlugin(ctx, false)],
        build: { outDir, rolldownOptions: { input: join(project.root, 'entry.js') } },
      })
      const files = await readdir(outDir, { recursive: true })
      const output = (await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(join(outDir, file), 'utf8')))).join('\n')
      expect(output).toContain(MARKERS.packageClient)
      expect(output).toContain(MARKERS.localFrame)
      expect(output).toContain('warm')
      expect(output).not.toContain(MARKERS.devOnly)
      expect(output).not.toContain(MARKERS.devOnlyDependency)
      expect(output).not.toContain(MARKERS.nodeOnly)
    }
    finally {
      await closeContext(ctx)
    }
  })
})
