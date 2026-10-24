import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromQuasarCliConfig } from '../config/from-cli.js'
import { createCliConfig } from './utils/cli-config.js'

const appDir = '/project'

describe('fromQuasarCliConfig', () => {
  it('keeps client-side boot files and stylesheets only', () => {
    const conf = fromQuasarCliConfig(createCliConfig({
      boot: [{ path: '@/boot/axios' }, { path: '/ae/src/boot/register.js' }, { path: '@/boot/server', client: false }],
      css: [{ path: '@/css/app.scss' }, { path: '@/css/server.scss', client: false }],
    }), { exists: () => false })
    expect(conf.boot).toEqual(['@/boot/axios', '/ae/src/boot/register.js'])
    expect(conf.css).toEqual(['@/css/app.scss'])
  })

  it('resolves the store file only when Quasar CLI found one', () => {
    const files = new Set([join(appDir, 'src/stores/index.ts'), join(appDir, 'src/router/index.js')])
    const exists = (path: string) => files.has(path)
    const withStore = fromQuasarCliConfig(createCliConfig(), { exists })
    expect(withStore.storeFile).toBe('/project/src/stores/index.ts')
    expect(withStore.hasRouter).toBe(true)
    const withoutStore = fromQuasarCliConfig(createCliConfig({ metaConf: { hasStore: false, css: { quasarSrcExt: 'css' } } }), { exists })
    expect(withoutStore.storeFile).toBeUndefined()
  })
})
