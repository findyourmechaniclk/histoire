/** Values from the loaded Nuxt app baked into the generated story setup code. */
export interface NuxtSetupCodeOptions {
  /** Global CSS files (`css` in `nuxt.config`). */
  css: string[]
  /** Public runtime config. */
  publicConfig: Record<string, unknown>
  /** `app` options of `nuxt.config`. */
  appConfig: Record<string, unknown>
  /** `@nuxtjs/color-mode` is installed: install its helper, following Histoire dark mode. */
  colorMode?: boolean
  /** File of Nuxt UI's `App` component, to wrap stories in it. */
  uiApp?: string
}

/** Generates the setup code modules booting Nuxt in each story app. */
export function createSetupCode(options: NuxtSetupCodeOptions): string[] {
  const imports = [`import { setupNuxtApp } from '@histoire/plugin-nuxt/dist/runtime/app-setup.js'`]
  const integrations: string[] = []
  // Only import what exists: these modules can't be resolved without the integration.
  if (options.colorMode) {
    imports.push(`import * as colorModeOptions from '#build/color-mode-options.mjs'`)
    integrations.push('colorMode: colorModeOptions')
  }
  if (options.uiApp) {
    imports.push(`import UiApp from ${JSON.stringify(options.uiApp)}`)
    integrations.push('uiApp: UiApp')
  }
  return [
    options.css.map(file => `import '${file}'`).join('\n'),
    `${imports.join('\n')}
export async function setupVue3 (setupApi) {
  await setupNuxtApp(${JSON.stringify(options.publicConfig)}, setupApi, { ...${JSON.stringify(options.appConfig)}, baseURL: import.meta.env.BASE_URL }, ${integrations.length ? `{ ${integrations.join(', ')} }` : '{}'})
}`,
  ]
}
