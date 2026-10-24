import type { AddressInfo } from 'node:net'
import type { InlineConfig, ViteDevServer } from 'vite'
import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'pathe'
import { build, createServer, mergeConfig } from 'vite'
import { closeContext, createContext } from '../../context.js'
import { resolveHistoireAppBundledDir } from '../../util/resolve-histoire-app.js'
import { getViteConfigWithPlugins } from '../../vite/index.js'
import { MCP_REPOSITORY_ROOT } from './mcp/cli-project.js'
import { createWorkbenchPluginProject } from './workbench-plugin-project.js'

/** Resolves like the prebuilt workbench does. */
const appRequire = createRequire(join(resolveHistoireAppBundledDir(), 'index.js'))
/** Vendor Vue file the prebuilt workbench imports. */
export const VENDOR_VUE = appRequire.resolve('@histoire/vendors/vue')
/** Prebuilt app module importing both vendor Vue and the bundled controls copy. */
export const APP_MODULE = join(resolveHistoireAppBundledDir(), 'components/shell/WorkbenchErrorState.vue_vue_type_script_setup_true_lang.js')

/**
 * Lists static and dynamic import URLs of served or generated module code.
 * @param code Module code.
 */
export function importUrls(code: string): string[] {
  return [...code.matchAll(/(?:\bfrom|\bimport\(?)\s*"([^"]+)"/g)].map(match => match[1])
}

/**
 * Temporary project for workbench Vue resolution: the workbench plugin fixture plus
 * `@histoire/plugin-kit` linked like a plugin's own dependency, no `vue` installed.
 */
export async function createWorkbenchVueProject() {
  const project = await createWorkbenchPluginProject()
  await mkdir(join(project.root, 'node_modules/@histoire'), { recursive: true })
  const pluginKit = dirname(dirname(appRequire.resolve('@histoire/plugin-kit')))
  await symlink(pluginKit, join(project.root, 'node_modules/@histoire/plugin-kit'), 'junction')

  /**
   * Writes files below the project root.
   * @param files Contents keyed by root-relative path.
   */
  async function writeFiles(files: Record<string, string>) {
    for (const [path, text] of Object.entries(files)) {
      await mkdir(dirname(join(project.root, path)), { recursive: true })
      await writeFile(join(project.root, path), text)
    }
  }

  return {
    ...project,
    writeFiles,
    /**
     * Links packages installed for a repository example into the project.
     * @param example Example folder name under `examples/`.
     * @param names Package names.
     */
    async linkExampleDependencies(example: string, names: string[]) {
      const exampleRequire = createRequire(join(MCP_REPOSITORY_ROOT, 'examples', example, 'package.json'))
      for (const name of names) {
        await mkdir(dirname(join(project.root, 'node_modules', name)), { recursive: true })
        await symlink(dirname(exampleRequire.resolve(`${name}/package.json`)), join(project.root, 'node_modules', name), 'junction')
      }
    },
    /**
     * Runs the real Histoire dev server of the project with a module fetcher.
     * @param run Assertions run while the server listens; `get` throws on non-200.
     * @param overrides Vite config merged over Histoire's.
     */
    async withDevServer(run: (get: (path: string) => Promise<string>, server: ViteDevServer) => Promise<void>, overrides: InlineConfig = {}) {
      const ctx = await createContext({ root: project.root, mode: 'dev' })
      const { viteConfig } = await getViteConfigWithPlugins(false, ctx)
      const server = await createServer(mergeConfig({ ...viteConfig, configFile: false, logLevel: 'silent', server: { ...viteConfig.server, port: 0, hmr: false, watch: null } }, overrides))
      try {
        await server.listen()
        const origin = `http://localhost:${(server.httpServer!.address() as AddressInfo).port}`
        await run(async (path) => {
          const response = await fetch(new URL(path, origin))
          const text = await response.text()
          if (response.status !== 200) throw new Error(`${response.status} ${path}: ${text.slice(0, 500)}`)
          return text
        }, server)
      }
      finally {
        await server.close()
        await closeContext(ctx)
      }
    },
    /**
     * Builds `entry` with Histoire's static build config and imports the output in Node.
     * Unminified, without module preload so the output runs outside a document.
     * @param entry Root-relative entry module.
     */
    async buildAndImport(entry: string): Promise<Record<string, any>> {
      const ctx = await createContext({ root: project.root, mode: 'build' })
      const outDir = join(project.root, 'out')
      try {
        const { viteConfig } = await getViteConfigWithPlugins(false, ctx)
        await build(mergeConfig(viteConfig, {
          configFile: false,
          logLevel: 'silent',
          build: { outDir, minify: false, modulePreload: false, rolldownOptions: { input: join(project.root, entry), preserveEntrySignatures: 'strict', output: { entryFileNames: 'entry.js' } } },
        }))
      }
      finally {
        await closeContext(ctx)
      }
      return import(pathToFileURL(join(outDir, 'entry.js')).href)
    },
    /** Build output directory of {@link buildAndImport}. */
    outDir: join(project.root, 'out'),
  }
}
