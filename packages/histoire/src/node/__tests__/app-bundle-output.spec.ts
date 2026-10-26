import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Built artifacts are the shared input consumed by stories and sandbox documents. */
const bundledDirectory = fileURLToPath(new URL('../../../../histoire-app/dist/bundled/', import.meta.url))

describe('shared app bundle output', () => {
  it('emits each source module in exactly one chunk across all app entries', async () => {
    const files = await readdir(bundledDirectory, { recursive: true })
    const owners = new Map<string, Set<string>>()
    for (const file of files.filter(file => file.endsWith('.js'))) {
      const code = await readFile(`${bundledDirectory}/${file}`, 'utf8')
      for (const match of code.matchAll(/^\/\/(?:#region)? (src\/.+)$/gm)) {
        const source = match[1]
        const chunks = owners.get(source) ?? new Set<string>()
        chunks.add(file)
        owners.set(source, chunks)
      }
    }

    // Rolldown emits either simple module comments or region markers.
    // Require markers from entries with own code so minification or stale output
    // cannot make the duplicate check pass without examining actual app modules.
    // The sandbox entry only re-exports shared modules, so it has no marker.
    expect([...owners.keys()]).toEqual(expect.arrayContaining([
      'src/app/api.ts',
      'src/app/index.ts',
    ]))
    const duplicates = [...owners].filter(([, chunks]) => chunks.size > 1).map(([source, chunks]) => ({ source, chunks: [...chunks] }))
    expect(duplicates).toEqual([])
  })
})
