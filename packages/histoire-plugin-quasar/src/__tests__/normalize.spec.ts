import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeQuasarConfig } from '../config/normalize.js'

const root = '/project'

/** Fake file system containing only listed project-relative files. */
function fsWith(...files: string[]) {
  const set = new Set(files.map(file => join(root, file)))
  return (path: string) => set.has(path)
}

describe('normalizeQuasarConfig', () => {
  it('resolves boot and css entries like Quasar CLI, keeping client ones', () => {
    const conf = normalizeQuasarConfig({
      boot: ['axios', '~some-pkg/boot', { path: 'server-only', client: false }, '', 'axios'],
      css: ['app.scss', { path: '~pkg/style.css' }],
      extras: ['roboto-font', 'material-icons', 'roboto-font'],
      animations: ['fadeIn'],
    }, { root, exists: fsWith(), allAnimations: () => [] })
    expect(conf.boot).toEqual(['@/boot/axios', 'some-pkg/boot'])
    expect(conf.css).toEqual(['@/css/app.scss', 'pkg/style.css'])
    expect(conf.extras).toEqual(['roboto-font', 'material-icons'])
    expect(conf.animations).toEqual(['fadeIn'])
  })

  it('resolves framework lang/iconSet shorthands and keeps plugin lists', () => {
    const conf = normalizeQuasarConfig({
      framework: {
        config: { brand: { primary: '#f00' } },
        plugins: ['Notify', 'Dialog', 'Notify'],
        lang: 'de',
        iconSet: 'some/icon-set',
      },
    }, { root, exists: fsWith(), allAnimations: () => [] })
    expect(conf.framework).toEqual({
      config: { brand: { primary: '#f00' } },
      components: [],
      directives: [],
      plugins: ['Notify', 'Dialog'],
      lang: 'quasar/lang/de.js',
      iconSet: 'some/icon-set.js',
    })
  })

  it('detects sass variables, store and router source files like Quasar CLI', () => {
    const conf = normalizeQuasarConfig({}, {
      root,
      exists: fsWith('src/css/quasar.variables.scss', 'src/stores/index.ts', 'src/router/index.tsx'),
      allAnimations: () => [],
    })
    expect(conf.quasarSrcExt).toBe('sass')
    expect(conf.storeFile).toBe('/project/src/stores/index.ts')
    expect(conf.hasRouter).toBe(true)

    const explicit = normalizeQuasarConfig({ sourceFiles: { store: 'src/stores/main.ts' } }, { root, exists: fsWith('src/stores/main.ts'), allAnimations: () => [] })
    expect(explicit.storeFile).toBe('/project/src/stores/main.ts')

    const plain = normalizeQuasarConfig({ sourceFiles: { store: 'src/custom-store' } }, { root, exists: fsWith('src/stores/index.ts'), allAnimations: () => [] })
    expect(plain.quasarSrcExt).toBe('css')
    expect(plain.storeFile).toBeUndefined()
    expect(plain.hasRouter).toBe(false)
  })

  it('expands all animations and imports Quasar component spinners', () => {
    const conf = normalizeQuasarConfig({
      animations: 'all',
      framework: { config: { loading: { spinner: 'QSpinnerGears' }, notify: { spinner: 'not-a-component' } } },
    }, { root, exists: fsWith(), allAnimations: () => ['bounce', 'fadeIn'] })
    expect(conf.animations).toEqual(['bounce', 'fadeIn'])
    expect(conf.framework.components).toEqual(['QSpinnerGears'])
  })
})
