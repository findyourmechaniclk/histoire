import { describe, expect, it } from 'vitest'
import { toHistoireViteConfig } from '../config/vite.js'

describe('toHistoireViteConfig', () => {
  it('keeps app compilation settings and drops Quasar CLI server/build ownership', () => {
    const vue = { name: 'vite:vue' }
    const quasar = { name: 'vite:quasar' }
    const user = { name: 'user-plugin' }
    const config = toHistoireViteConfig({
      configFile: false,
      root: '/project',
      base: '/app/',
      publicDir: '/project/public',
      cacheDir: '/project/node_modules/.q-cache',
      mode: 'development',
      envDir: false,
      clearScreen: false,
      logLevel: 'warn',
      define: { 'process.env.FOO': '"bar"' },
      resolve: { alias: { '@': '/project/src' } },
      css: { preprocessorOptions: { scss: {} } },
      build: { target: ['es2022'], emptyOutDir: false, outDir: 'dist' },
      server: { port: 9000 },
      optimizeDeps: { entries: ['index.html'], include: ['axios'] },
      plugins: [{ name: 'quasar:html' }, vue, [quasar, { name: 'quasar:strip-filename-hashes' }], { name: 'vite-plugin-vue-devtools' }, user, null],
    })
    expect(config).toEqual({
      publicDir: '/project/public',
      define: { 'process.env.FOO': '"bar"' },
      resolve: { alias: { '@': '/project/src' } },
      css: { preprocessorOptions: { scss: {} } },
      build: { target: ['es2022'] },
      optimizeDeps: { include: ['axios'] },
      plugins: [vue, quasar, user],
    })
  })
})
