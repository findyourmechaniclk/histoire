import { describe, expect, it } from 'vitest'
import { disableDevServer, isQuasarCliConfig } from '../config/quasar-cli.js'
import { createCliConfig } from './utils/cli-config.js'

describe('isQuasarCliConfig', () => {
  it('accepts the normalized shape and rejects drifted internals', () => {
    const conf = createCliConfig()
    expect(isQuasarCliConfig(conf)).toBe(true)
    expect(isQuasarCliConfig({ ...conf, metaConf: {} })).toBe(false)
    expect(isQuasarCliConfig({ ...conf, boot: undefined })).toBe(false)
    expect(isQuasarCliConfig(undefined)).toBe(false)
  })
})

describe('disableDevServer', () => {
  it('disables Quasar dev server features after App Extension hooks ran', async () => {
    let rawConf: any = { devServer: { https: true, open: true, port: 9000 } }
    // Mirrors how Quasar CLI runs `extendQuasarConf` hooks on its raw config.
    const appExt = {
      async runAppExtensionHook(name: string, fn: (hook: any) => Promise<void>) {
        if (name !== 'extendQuasarConf') return
        await fn({ fn: () => ({ devServer: { https: true } }), api: { logger: { log() {} } }, packageDir: '/ae' })
      },
    }
    disableDevServer(appExt)
    await appExt.runAppExtensionHook('extendQuasarConf', async (hook) => {
      // Quasar logs through the hook API before running each hook.
      hook.api.logger.log('Extending quasar.config file configuration...')
      const overrides = await hook.fn(rawConf, hook.api)
      if (overrides) rawConf = { ...rawConf, devServer: { ...rawConf.devServer, ...overrides.devServer } }
    })
    // No certificate generation nor browser opening for a server Histoire never starts.
    expect(rawConf.devServer).toEqual({ https: false, open: false, port: 9000 })
  })
})
