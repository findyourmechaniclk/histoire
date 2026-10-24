import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Built package proves published shape rather than source aliases. */
const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))

/** Collects bare specifiers reachable from one emitted entry through relative imports. */
function collectBareImports(entry: string): Set<string> {
  const bare = new Set<string>()
  const queue = [resolve(packageRoot, entry)]
  const seen = new Set<string>()
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:from\s*|import\s*\(?)(['"])([^'"]+)\1/g)) {
      const specifier = match[2]
      if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier))
      else bare.add(specifier)
    }
  }
  return bare
}

describe('plugin-kit package entries', () => {
  it('imports root and frame entries in plain Node without DOM globals', () => {
    // Self-reference through the package name exercises the `exports` map.
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
      delete globalThis.window; delete globalThis.document;
      const kit = await import('@histoire/plugin-kit');
      const frame = await import('@histoire/plugin-kit/frame');
      if (typeof kit.defineWorkbenchPlugin !== 'function' || typeof frame.defineFramePlugin !== 'function') throw new Error('missing');
      console.log('portable');
    `], { encoding: 'utf8', cwd: packageRoot })
    expect(output.trim()).toBe('portable')
  })

  it('keeps root and frame graphs free of framework, Node and Vite imports', () => {
    for (const entry of ['dist/index.js', 'dist/index.d.ts', 'dist/frame.js', 'dist/frame.d.ts']) {
      for (const specifier of collectBareImports(entry)) {
        expect(specifier, `${entry} imports ${specifier}`).toBe('@histoire/protocol')
      }
    }
  })

  it('keeps each adapter graph to its own framework', () => {
    const allowed: Record<string, string[]> = {
      'dist/react/index.js': ['react', 'react-dom', 'react-dom/client'],
      'dist/svelte4/index.js': [],
      'dist/svelte5/index.js': ['svelte', 'svelte/reactivity'],
      'dist/vue/index.js': ['vue'],
      'dist/vue/mount.js': ['vue'],
    }
    for (const [entry, frameworks] of Object.entries(allowed)) {
      expect([...collectBareImports(entry)].sort(), entry).toEqual(frameworks)
    }
  })

  it('resolves every exported subpath to emitted code and declarations', () => {
    for (const [subpath, target] of Object.entries<{ types: string, default: string }>(packageJson.exports)) {
      expect(existsSync(resolve(packageRoot, target.default)), `${subpath} code`).toBe(true)
      expect(existsSync(resolve(packageRoot, target.types)), `${subpath} types`).toBe(true)
    }
  })
})
