import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { prebundleTranspiledDeps, resolveIncludeId } from '../../../../histoire-plugin-nuxt/src/prebundle.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** Writes a minimal package (package.json + entry) at `dir`. */
function writePackage(dir: string, name: string, dependencies: Record<string, string> = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, main: 'index.js', dependencies }))
  writeFileSync(join(dir, 'index.js'), '')
}

describe('plugin-nuxt prebundled transpile deps', () => {
  it('moves known client-only UI libraries from exclude to include', () => {
    // Nuxt UI pushes `reka-ui` to `build.transpile`, which Nuxt (4.6+) excludes
    // from optimization: every story frame then loads hundreds of raw modules.
    const optimizeDeps = prebundleTranspiledDeps(
      { include: ['@rstore/vue'], exclude: ['vue', 'reka-ui', '#imports'] },
      ['reka-ui', '/abs/runtime', /regex/, '@unhead/vue'],
      ['my-lib'],
      dep => dep === 'reka-ui' ? '@nuxt/ui > reka-ui' : dep,
    )
    expect(optimizeDeps.exclude).toEqual(['vue', '#imports'])
    expect(optimizeDeps.include).toEqual(['@rstore/vue', '@nuxt/ui > reka-ui', 'my-lib'])
  })

  it('leaves optimizeDeps alone when nothing resolvable is transpiled', () => {
    const optimizeDeps = prebundleTranspiledDeps({ include: [], exclude: ['vue'] }, ['@unhead/vue', 'reka-ui'], [], () => null)
    expect(optimizeDeps).toEqual({ include: [], exclude: ['vue'] })
  })
})

describe('resolveIncludeId', () => {
  it('reaches a library only installed for a project dependency (pnpm)', () => {
    // Vite never discovers imports between node_modules packages, and a bare
    // include must resolve from the project root.
    const root = mkdtempSync(join(tmpdir(), 'histoire-nuxt-prebundle-'))
    roots.push(root)
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'app', dependencies: { '@nuxt/ui': '*' } }))
    writePackage(join(root, 'node_modules/@nuxt/ui'), '@nuxt/ui', { 'reka-ui': '*' })
    writePackage(join(root, 'node_modules/@nuxt/ui/node_modules/reka-ui'), 'reka-ui')
    writePackage(join(root, 'node_modules/hoisted-lib'), 'hoisted-lib')

    expect(resolveIncludeId(root, 'reka-ui')).toBe('@nuxt/ui > reka-ui')
    expect(resolveIncludeId(root, 'hoisted-lib')).toBe('hoisted-lib')
    expect(resolveIncludeId(root, 'missing-lib')).toBeNull()
  })
})
