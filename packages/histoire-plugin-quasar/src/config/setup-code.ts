import type { ResolvedQuasarConfig } from './types.js'
import { getConfigSpinners, unique } from './utils.js'

/** Module path of the runtime helper imported by generated setup code. */
const RUNTIME_ID = '@histoire/plugin-quasar/runtime'

/** Stylesheet imports in the same order as Quasar CLI's client entry. */
function styleImports(conf: ResolvedQuasarConfig): string[] {
  return [
    ...conf.extras.map(asset => `@quasar/extras/${asset}/${asset}.css`),
    ...conf.animations.map(asset => `@quasar/extras/animate/${asset}.css`),
    `quasar/dist/quasar.${conf.quasarSrcExt}`,
    ...conf.cssAddon ? ['quasar/src/css/flex-addon.sass'] : [],
    ...conf.css,
  ].map(path => `import ${JSON.stringify(path)}`)
}

/** `{ config, components, directives, plugins, lang, iconSet }` options source. */
function frameworkOptions(conf: ResolvedQuasarConfig): string {
  const { framework } = conf
  const entries = [`config: ${JSON.stringify(framework.config)}`]
  for (const type of ['components', 'directives', 'plugins'] as const) {
    if (framework[type].length) entries.push(`${type}: { ${framework[type].join(', ')} }`)
  }
  if (framework.lang) entries.push('lang')
  if (framework.iconSet) entries.push('iconSet')
  return `{ ${entries.join(', ')} }`
}

/**
 * Generate the `setupCode` module installing Quasar like Quasar CLI's app
 * entry does: styles, `app.use(Quasar)`, store, then client boot files.
 */
export function generateSetupCode(conf: ResolvedQuasarConfig): string {
  const { framework } = conf
  // `Dark` is always imported: the runtime syncs it with Histoire's dark mode.
  const quasarImports = unique(['Quasar', 'Dark', ...framework.components, ...framework.directives, ...framework.plugins])
  const imports = [
    ...styleImports(conf),
    `import { ${quasarImports.join(', ')} } from 'quasar'`,
    ...framework.lang ? [`import lang from ${JSON.stringify(framework.lang)}`] : [],
    ...framework.iconSet ? [`import iconSet from ${JSON.stringify(framework.iconSet)}`] : [],
    ...conf.storeFile ? [`import createStore from ${JSON.stringify(conf.storeFile)}`] : [],
    ...conf.hasRouter ? [`import { createRouter, createMemoryHistory } from 'vue-router'`] : [],
    `import { setupQuasarApp } from '${RUNTIME_ID}'`,
  ]
  const bootFiles = conf.boot.map(path => `{ path: ${JSON.stringify(path)}, load: () => import(${JSON.stringify(path)}) }`)
  // Spinners are component identifiers, not strings (Quasar CLI does the same).
  const spinners = getConfigSpinners(framework.config)
    .map(({ key, spinner }) => `options.config.${key}.spinner = ${spinner}`)
  const options = [
    'Quasar,',
    'Dark,',
    'options,',
    ...conf.storeFile ? ['createStore,'] : [],
    // Memory history keeps router-aware boot files away from the sandbox URL.
    ...conf.hasRouter ? ['createRouter: () => createRouter({ history: createMemoryHistory(), routes: [] }),'] : [],
    `bootFiles: [${bootFiles.join(', ')}],`,
  ]
  return `${imports.join('\n')}

const options = ${frameworkOptions(conf)}
${spinners.join('\n')}

export async function setupVue3 (setupApi) {
  await setupQuasarApp(setupApi, {
    ${options.join('\n    ')}
  })
}
`
}
