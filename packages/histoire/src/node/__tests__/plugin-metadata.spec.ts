import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { getHistoireIcon } from '../../../../histoire-shared/src/icons/index.js'
import { resolvePluginMetadata } from '../config/plugin-metadata.js'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('plugin metadata', () => {
  it('combines explicit metadata with matching project package metadata without leaking private fields', async () => {
    const root = await mkdtemp(join(tmpdir(), 'histoire-plugin-metadata-'))
    roots.push(root)
    const directory = join(root, 'node_modules', '@example', 'plugin')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: '@example/plugin', description: 'Package description', homepage: 'https://example.com/docs', repository: { url: 'git+https://github.com/example/plugin.git' }, privateKey: 'secret' }))
    const result = await resolvePluginMetadata(root, [
      { name: '@example/plugin', metadata: { displayName: 'Example', description: 'Plugin description', logoUrl: 'https://example.com/logo.png', docsUrl: 'javascript:alert(1)' } },
      { name: '@example/plugin' },
      { name: '../secret' },
    ])
    expect(result).toEqual([
      { displayName: 'Example', description: 'Plugin description', logoUrl: 'https://example.com/logo.png', docsUrl: 'https://example.com/docs', repoUrl: 'https://github.com/example/plugin' },
      { description: 'Package description', docsUrl: 'https://example.com/docs', repoUrl: 'https://github.com/example/plugin' },
      {},
    ])
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('ignores mismatched packages and unsafe URLs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'histoire-plugin-metadata-'))
    roots.push(root)
    const directory = join(root, 'node_modules', 'other')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'not-other', description: 'Wrong package' }))
    expect(await resolvePluginMetadata(root, [{ name: 'other', metadata: { logoUrl: 'http://example.com/a.svg', repoUrl: 'file:///etc/passwd', docsUrl: 'javascript:alert(1)' } }])).toEqual([{}])
  })

  it('supplies an offline puzzle glyph and rejects unknown metadata icons', async () => {
    expect(getHistoireIcon('puzzle')?.body).toContain('<path')
    expect(await resolvePluginMetadata('/not-a-project', [
      { name: 'local', metadata: { icon: 'puzzle' } },
      { name: 'local', metadata: { icon: 'missing-glyph' } },
    ])).toEqual([{ icon: 'puzzle' }, {}])
  })

  it('converts common GitHub repository references to safe browser links', async () => {
    expect(await resolvePluginMetadata('/not-a-project', [
      { name: 'local', metadata: { repoUrl: 'github:example/one' } },
      { name: 'local', metadata: { repoUrl: 'git@github.com:example/two.git' } },
      { name: 'local', metadata: { repoUrl: 'git+ssh://git@github.com/example/three.git' } },
    ])).toEqual([
      { repoUrl: 'https://github.com/example/one' },
      { repoUrl: 'https://github.com/example/two' },
      { repoUrl: 'https://github.com/example/three' },
    ])
  })
})
