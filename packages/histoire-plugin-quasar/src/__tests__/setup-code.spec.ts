import { describe, expect, it } from 'vitest'
import { generateSetupCode } from '../config/setup-code.js'

const base = {
  boot: [],
  css: [],
  extras: [],
  animations: [],
  cssAddon: false,
  quasarSrcExt: 'css' as const,
  framework: { config: {}, components: [], directives: [], plugins: [] },
  hasRouter: false,
}

describe('generateSetupCode', () => {
  it('imports styles in Quasar CLI order and wires framework options, store, router and boot files', () => {
    const code = generateSetupCode({
      ...base,
      boot: ['@/boot/axios'],
      css: ['@/css/app.scss'],
      extras: ['roboto-font'],
      animations: ['fadeIn'],
      cssAddon: true,
      quasarSrcExt: 'sass',
      framework: { config: { dark: 'auto' }, components: [], directives: [], plugins: ['Notify'], lang: 'quasar/lang/de.js' },
      storeFile: '/project/src/stores/index.ts',
      hasRouter: true,
    })
    const imports = [...code.matchAll(/^import .*$/gm)].map(match => match[0])
    expect(imports).toEqual([
      `import "@quasar/extras/roboto-font/roboto-font.css"`,
      `import "@quasar/extras/animate/fadeIn.css"`,
      `import "quasar/dist/quasar.sass"`,
      `import "quasar/src/css/flex-addon.sass"`,
      `import "@/css/app.scss"`,
      `import { Quasar, Dark, Notify } from 'quasar'`,
      `import lang from "quasar/lang/de.js"`,
      `import createStore from "/project/src/stores/index.ts"`,
      `import { createRouter, createMemoryHistory } from 'vue-router'`,
      `import { setupQuasarApp } from '@histoire/plugin-quasar/runtime'`,
    ])
    expect(code).toContain(`const options = { config: {"dark":"auto"}, plugins: { Notify }, lang }`)
    expect(code).toContain(`createStore,`)
    expect(code).toContain(`createRouter: () => createRouter({ history: createMemoryHistory(), routes: [] }),`)
    expect(code).toContain(`{ path: "@/boot/axios", load: () => import("@/boot/axios") }`)
    expect(code).toContain('export async function setupVue3 (setupApi) {')
  })

  it('omits store and router when the project has none', () => {
    const code = generateSetupCode(base)
    expect(code).toContain(`import "quasar/dist/quasar.css"`)
    expect(code).not.toContain('createStore')
    expect(code).not.toContain('vue-router')
  })

  it('passes component spinners to Quasar config as components', () => {
    const code = generateSetupCode({
      ...base,
      framework: { ...base.framework, config: { loading: { spinner: 'QSpinnerGears' } }, components: ['QSpinnerGears'] },
    })
    expect(code).toContain(`import { Quasar, Dark, QSpinnerGears } from 'quasar'`)
    expect(code).toContain('options.config.loading.spinner = QSpinnerGears')
  })
})
