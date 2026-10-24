import type { ResolvedWorkbenchPlugin } from '../config/workbench-plugins.js'
import type { Context } from '../context.js'
import { parseSync } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { resolvedCommands } from '../virtual/resolved-commands.js'
import { resolvedFramePlugins } from '../virtual/resolved-frame-plugins.js'
import { resolvedWorkbenchPlugins } from '../virtual/resolved-workbench-plugins.js'

const ODD_PATH = `/project/odd dir it's/"quoted".js`

const plugins: ResolvedWorkbenchPlugin[] = [
  { id: 'acme', apiVersion: 1, options: { tone: 'warm', nested: [1, null] }, devOnly: false, client: ODD_PATH },
  { id: 'local', apiVersion: 1, options: undefined, devOnly: false, frame: '/project/plugins/frame.js' },
  { id: 'dev-tools', apiVersion: 1, options: undefined, devOnly: true, client: '/project/plugins/dev.js', frame: '/project/plugins/dev-frame.js' },
]

/**
 * Executes a generated manifest, substituting its module transport only.
 * @param source Generated module code.
 * @param exportName Exported manifest binding.
 * @param load Stand-in for dynamic `import()`.
 */
function evaluateManifest(source: string, exportName: string, load: (specifier: string) => Promise<unknown>) {
  const body = source.replace(/\bimport\(/g, 'load(').replace(/^export /gm, '')
  // eslint-disable-next-line no-new-func -- execute trusted generated manifest glue with an injected module transport
  return new Function('load', `${body};return ${exportName}`)(load)
}

describe('browser plugin manifests', () => {
  it('lists workbench entries lazily in config order with exact specifiers and options', async () => {
    const load = vi.fn(async (specifier: string) => ({ default: specifier }))
    const manifest = evaluateManifest(resolvedWorkbenchPlugins({ workbenchPlugins: plugins } as Context, 'serve'), 'workbenchPlugins', load)
    expect(manifest.map(entry => [entry.id, entry.apiVersion, entry.options])).toEqual([
      ['acme', 1, { tone: 'warm', nested: [1, null] }],
      ['dev-tools', 1, undefined],
    ])
    expect(load).not.toHaveBeenCalled()
    expect(await manifest[0].load()).toEqual({ default: ODD_PATH })
    expect(load).toHaveBeenCalledExactlyOnceWith(ODD_PATH)
  })

  it('lists frame entries separately and omits dev-only entries from static builds', () => {
    const load = vi.fn()
    const frames = evaluateManifest(resolvedFramePlugins({ workbenchPlugins: plugins } as Context, 'build'), 'framePlugins', load)
    const clients = evaluateManifest(resolvedWorkbenchPlugins({ workbenchPlugins: plugins } as Context, 'build'), 'workbenchPlugins', load)
    expect(frames.map(entry => entry.id)).toEqual(['local'])
    expect(clients.map(entry => entry.id)).toEqual(['acme'])
  })
})

describe('command client setup modules', () => {
  it('imports resolved setup files for default and named exports', () => {
    const defaultCommand = { id: 'default', label: 'Default', clientSetupFile: '/odd.js' }
    const namedCommand = { id: 'named', label: 'Named', clientSetupFile: { file: 'pkg/setup', importName: 'setup' } }
    const ctx = {
      registeredCommands: [defaultCommand, namedCommand],
      commandClientSetupFiles: new Map([[defaultCommand, ODD_PATH], [namedCommand, '/pkg/setup.js']]),
    } as unknown as Context
    const program = parseSync('commands.js', resolvedCommands(ctx)).program
    const imports = program.body.filter(node => node.type === 'ImportDeclaration')
    expect(imports.map(node => [node.source.value, node.specifiers.map(specifier => specifier.type)])).toEqual([
      [ODD_PATH, ['ImportDefaultSpecifier']],
      ['/pkg/setup.js', ['ImportSpecifier']],
    ])
  })
})
