import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'pathe'
import { createMcpProjectFixture } from './mcp/project.js'

/** Strings written into fixture modules; scanned for in served code and build output. */
export const WORKBENCH_FIXTURE_MARKERS = {
  /** Default export of the installed package's `client` entry. */
  packageClient: 'acme-package-client-marker',
  /** Default export of the project-local `frame` entry. */
  localFrame: 'local-frame-marker',
  /** Default export of the dev-only `client` entry. */
  devOnly: 'dev-only-client-marker',
  /** Module imported only by the dev-only entry. */
  devOnlyDependency: 'dev-only-transitive-marker',
  /** Default export of the command client setup file. */
  command: 'command-client-marker',
  /** Value of a Node-only plugin field that must never reach the browser. */
  nodeOnly: 'node-only-plugin-sentinel',
} as const

/** Project-local folder whose name needs quoting in generated module code. */
export const ODD_DIRECTORY = `odd dir it's`

/**
 * Owns a temporary project (`<tmp>/project`) with project-local plugin entries and an
 * installed package (`acme-plugin`) linked from a sibling folder outside the project root,
 * like a workspace or `npm link` install.
 */
export async function createWorkbenchPluginProject() {
  const fixture = await createMcpProjectFixture()
  const root = join(fixture.root, 'project')
  const packageDir = join(fixture.root, 'acme-plugin')
  const markers = WORKBENCH_FIXTURE_MARKERS
  const files: Record<string, string> = {
    [join(packageDir, 'package.json')]: JSON.stringify({ name: 'acme-plugin', type: 'module', exports: { './client': './client.js' } }),
    [join(packageDir, 'client.js')]: `export default ${JSON.stringify(markers.packageClient)}\n`,
    // Never imported, like a font referenced from CSS: Vite serves it only when `server.fs.allow`
    // covers the package (imported modules are trusted through the module graph instead).
    [join(packageDir, 'icon.svg')]: '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
    [join(root, 'package.json')]: JSON.stringify({ name: 'workbench-plugin-fixture', private: true, type: 'module' }),
    [join(root, 'plugins/frame.js')]: `export default ${JSON.stringify(markers.localFrame)}\n`,
    [join(root, 'plugins/dev-only.js')]: `import dependency from './dev-only-dependency.js'\nexport default [${JSON.stringify(markers.devOnly)}, dependency]\n`,
    [join(root, 'plugins/dev-only-dependency.js')]: `export default ${JSON.stringify(markers.devOnlyDependency)}\n`,
    [join(root, ODD_DIRECTORY, 'command.js')]: `export default { marker: ${JSON.stringify(markers.command)} }\n`,
  }
  for (const [file, text] of Object.entries(files)) {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, text)
  }
  await mkdir(join(root, 'node_modules'), { recursive: true })
  // Junctions work without privileges on Windows; POSIX ignores the type.
  await symlink(packageDir, join(root, 'node_modules/acme-plugin'), 'junction')

  return {
    /** Histoire project root. */
    root,
    /** Real directory of the installed package, outside `root`. */
    packageDir,
    /**
     * Writes `histoire.config.js` exporting the given config source.
     * @param source JavaScript expression of the config object.
     */
    async writeConfig(source: string) {
      await writeFile(join(root, 'histoire.config.js'), `export default ${source}\n`)
    },
    /** Removes the whole fixture, package included. */
    close: fixture.close,
  }
}

/** Config source enabling every fixture entry plus a command with a client setup file. */
export const WORKBENCH_FIXTURE_CONFIG = `{
  plugins: [
    { name: 'acme-node-plugin', privateField: ${JSON.stringify(WORKBENCH_FIXTURE_MARKERS.nodeOnly)}, workbench: { id: 'acme', apiVersion: 1, client: 'acme-plugin/client', options: { tone: 'warm' } } },
    { name: 'local-frames', workbench: { id: 'local', apiVersion: 1, frame: './plugins/frame.js' } },
    { name: 'dev-tools', workbench: { id: 'dev-tools', apiVersion: 1, client: './plugins/dev-only.js', devOnly: true } },
    { name: 'fixture-commands', commands: [{ id: 'fixture:run', label: 'Run fixture', clientSetupFile: ${JSON.stringify(`/${ODD_DIRECTORY}/command.js`)} }] },
  ],
}`
