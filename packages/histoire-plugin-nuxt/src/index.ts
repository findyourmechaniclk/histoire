import type { Plugin } from 'histoire'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import replace from '@rollup/plugin-replace'
import { nuxtDevHandlersPlugin } from './dev-handlers.js'
import { excludeAppPlugins, type NuxtPluginPattern } from './plugins.js'
import { prebundleTranspiledDeps, resolveIncludeId } from './prebundle.js'
import { isolateNuxtResolver } from './resolve.js'
import { createSetupCode } from './setup-code.js'
import { findUiAppComponent } from './ui-app.js'

/** Kit owns the loaded Nuxt shape; don't mix separately hoisted schema majors. */
type Nuxt = Awaited<ReturnType<typeof import('@nuxt/kit').loadNuxt>>

const ignorePlugins = [
  'nuxt:vite-node-server',
  'nuxt:dev-style-ssr',
  'nuxt:vite-relative-asset',
  'nuxt:cache-dir',
  'nuxt:dynamic-base-path',
  'nuxt:import-protection',
  // Histoire owns HTTP/HMR; Nuxt's Nitro adapter opens a second HMR listener.
  'nuxt:dev-server',
  // Looks for Nuxt's client entry, which Histoire doesn't have, and warns.
  'nuxt:module-preload-polyfill',
]

/** Nuxt uses process-wide internals; Vue/Svelte multi-root support does not extend it. */
let activeNuxtOwner: object | undefined

export interface HstNuxtOptions {
  /**
   * Nuxt build directory used by Histoire, relative to the Nuxt root.
   * Kept apart from `.nuxt` so a running `nuxt dev` doesn't share generated files.
   * By default `.histoire/nuxt`, or a run-owned directory while another Histoire
   * run of the project (e.g. the isolated test collection of `histoire dev`) uses it.
   * @default '.histoire/nuxt'
   */
  buildDir?: string
  /**
   * Packages from Nuxt's `build.transpile` to pre-bundle anyway, so story
   * frames don't load them as hundreds of separate modules. Known client-only
   * UI libraries (`reka-ui`, `radix-vue`) are always pre-bundled.
   */
  prebundle?: string[]
  /**
   * App plugins not to run in stories, e.g. background sync, analytics or PWA
   * plugins. A string matches a fragment of the plugin file path (forward
   * slashes), a `RegExp` is tested against that path.
   */
  excludePlugins?: NuxtPluginPattern[]
  /**
   * Wrap stories in Nuxt UI's `UApp` (tooltips, toasts and overlays need it)
   * when `@nuxt/ui` is installed.
   * @default true
   */
  uiApp?: boolean
}

/** Integrates one Nuxt project with explicit root and startup cleanup ownership. */
export function HstNuxt(options: HstNuxtOptions = {}): Plugin {
  const { prebundle = [], excludePlugins = [], uiApp = true } = options
  let nuxt: Nuxt
  const owner = {}
  let closing: Promise<void> | undefined
  /** Closes acquired Nuxt once, keeping ownership blocked after unconfirmed teardown. */
  function close() {
    return closing ??= (async () => {
      await nuxt?.close()
      if (activeNuxtOwner === owner) activeNuxtOwner = undefined
    })()
  }
  return {
    name: '@histoire/plugin-nuxt',

    async defaultConfig(_config, _mode, context) {
      if (activeNuxtOwner && activeNuxtOwner !== owner) throw new Error('Nuxt integration supports one active project per process')
      activeNuxtOwner = owner
      context?.onCleanup(close)
      let nuxtViteConfig: Awaited<ReturnType<typeof useNuxtViteConfig>>
      try {
        // Concurrent Nuxt instances must not regenerate the same build dir.
        const buildDir = options.buildDir ?? context?.claimDir?.('nuxt') ?? '.histoire/nuxt'
        nuxtViteConfig = await useNuxtViteConfig(context?.root ?? process.cwd(), { buildDir, excludePlugins }, (acquired) => {
          nuxt = acquired
        })
      }
      catch (error) {
        try {
          await close()
        }
        catch (cleanupError) {
          throw new AggregateError([error, cleanupError], String(error))
        }
        throw error
      }
      const { viteConfig, integrations } = nuxtViteConfig

      nuxt = nuxtViteConfig.nuxt // We save it to close it later
      const plugins = viteConfig.plugins.filter((p: any) => p && !ignorePlugins.includes(p.name)).map(plugin => isolateNuxtResolver(plugin as VitePlugin))
      return {
        vite: {
          base: nuxt.options.app.baseURL,
          server: {
            watch: viteConfig.server.watch,
            fs: {
              allow: viteConfig.server.fs.allow,
            },
          },
          define: {
            ...viteConfig.define,
            'process.server': false,
            'process.client': true,
            'process.browser': true,
            'process.nitro': false,
            'process.prerender': false,
          },
          resolve: {
            alias: viteConfig.resolve.alias,
            extensions: viteConfig.resolve.extensions,
            dedupe: viteConfig.resolve.dedupe,
          },
          plugins: [
            nuxtDevHandlersPlugin(nuxt.options.devServerHandlers),
            ...plugins,
            replace({
              values: {
                'import.meta.server': 'false',
                'import.meta.client': 'true',
              },
              preventAssignment: true,
            }),
          ],
          css: viteConfig.css,
          publicDir: viteConfig.publicDir,
          optimizeDeps: prebundleTranspiledDeps({
            ...viteConfig.optimizeDeps,
            exclude: [
              ...viteConfig.optimizeDeps.exclude,
              '@histoire/plugin-nuxt',
            ],
          }, nuxt.options.build.transpile, prebundle, dep => resolveIncludeId(nuxt.options.rootDir, dep)),
          // @ts-expect-error Vue-specific config
          vue: viteConfig.vue,
          logLevel: 'info',
        },
        setupCode: createSetupCode({
          css: nuxt.options.css,
          publicConfig: nuxt.options.runtimeConfig.public,
          appConfig: nuxt.options.app as unknown as Record<string, unknown>,
          colorMode: integrations.colorMode,
          uiApp: uiApp ? integrations.uiApp : undefined,
        }),
        viteNodeInlineDeps: [
          /\/(nuxt|nuxt3)\//,
          /^#/,
          new RegExp(escapeRegExp(nuxt.options.buildDir)),
          ...(nuxt.options.build.transpile.filter(
            r => typeof r === 'string' || r instanceof RegExp,
          ) as Array<string | RegExp>),
        ],
        build: {
          excludeFromVendorsChunk: [
            /nuxt\/dist\/app/,
          ],
        },
      }
    },

    onDev(api, onCleanup) {
      onCleanup(close)
    },

    onBuild(api) {
      api.onBuildEnd(close)
    },

    onPreview: close,
  }
}

/** Nuxt options of `HstNuxt` applied when loading Nuxt. */
interface NuxtLoadOptions {
  buildDir: string
  excludePlugins: NuxtPluginPattern[]
}

/** Registers Nuxt before later template/config steps can fail. */
async function useNuxtViteConfig(root: string, { buildDir, excludePlugins }: NuxtLoadOptions, onAcquire: (nuxt: Nuxt) => void) {
  const { loadNuxt, buildNuxt, hasNuxtModule } = await import('@nuxt/kit')
  const nuxt = await loadNuxt({
    cwd: root,
    ready: false,
    dev: true,
    overrides: {
      buildDir,
      devtools: { enabled: false },
      ssr: false,
      experimental: {
        appManifest: false,
      },
      app: {
        rootId: 'nuxt-test',
      },
      pages: false,
      typescript: {
        typeCheck: false,
      },
    },
  })
  onAcquire(nuxt)
  if (nuxt.options.builder as string !== '@nuxt/vite-builder') {
    throw new Error(`Histoire only supports Vite bundler, but Nuxt builder is currently set to '${nuxt.options.builder}'.`)
  }
  const runtimeDir = fileURLToPath(new URL('../runtime', import.meta.url))
  nuxt.options.build.templates.push(
    { src: join(runtimeDir, 'composables.mjs'), filename: 'histoire/composables.mjs' },
    { src: join(runtimeDir, 'components.mjs'), filename: 'histoire/components.mjs' },
  )

  nuxt.hook('app:resolve', (app) => {
    app.plugins = excludeAppPlugins(app.plugins, excludePlugins)
  })

  nuxt.hook('app:templates', (app) => {
    app.templates = app.templates.filter(template => template.filename !== 'app-component.mjs')
    app.templates.push({ src: join(runtimeDir, 'app-component.mjs'), filename: 'app-component.mjs' })
  })

  nuxt.hook('imports:sources', (presets) => {
    const polyfills = ['requestIdleCallback', 'cancelIdleCallback']
    const stubbedComposables = ['useNuxtApp']
    for (const appPreset of presets.filter(p => p && typeof p === 'object' && 'from' in p && p.from?.startsWith('#app'))) {
      if ('imports' in appPreset && Array.isArray(appPreset.imports)) {
        appPreset.imports = appPreset.imports.filter(i => typeof i !== 'string' || (!stubbedComposables.includes(i) && !polyfills.includes(i)))
      }
    }
    presets.push({
      from: '#build/histoire/composables.mjs',
      imports: stubbedComposables,
    })
  })

  /** Integrations with installed Nuxt modules, detected once modules are set up. */
  const integrations: { colorMode?: boolean, uiApp?: string } = {}

  return {
    viteConfig: await new Promise<ViteConfig>((resolve, reject) => {
      let captured = false
      nuxt.hook('modules:done', () => {
        integrations.colorMode = hasNuxtModule('@nuxtjs/color-mode', nuxt)
        const hasUi = hasNuxtModule('@nuxt/ui', nuxt)
        nuxt.hook('components:extend', (components) => {
          if (hasUi) integrations.uiApp = findUiAppComponent(components, (nuxt.options as { ui?: { prefix?: string } }).ui?.prefix)
          for (const name of ['NuxtLink']) {
            Object.assign(components.find(c => c.pascalName === name) || {}, {
              export: name,
              filePath: '#build/histoire/components.mjs',
            })
          }
        })

        nuxt.hook('vite:configResolved', (config, { isClient }) => {
          if (isClient && !captured) {
            captured = true
            resolve(config as any)
            // Nuxt generated templates/config already exist. Stop before its
            // own dev server acquires HTTP/HMR resources Histoire would duplicate.
            throw new Error('_stop_')
          }
        })
      })
      nuxt.ready()
        .then(() => buildNuxt(nuxt))
        .catch((err) => {
          if (!err.toString().includes('_stop_')) {
            reject(err)
          }
        })
    }),
    nuxt,
    integrations,
  }
}

/** Escapes a path for use as a literal inside a `RegExp`. */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
