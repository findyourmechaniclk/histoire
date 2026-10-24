import type { ResolvedConfig, Plugin as VitePlugin } from 'vite'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, normalize } from 'pathe'
import { resolveHistoireAppBundledDir } from '../util/resolve-histoire-app.js'
import { RESOLVED_WORKBENCH_PLUGINS_ID } from '../virtual/index.js'

/**
 * Query flag carried by every module of a workbench plugin client graph.
 *
 * Plugin client modules run inside the prebuilt workbench, which uses the vendored
 * `@histoire/vendors/vue` copy, while story code uses the project's own `vue` (or none
 * at all in React and Svelte projects). Marking the plugin graph gives each of its
 * modules a distinct id, so the same file reached from story code keeps the project's
 * resolution: two module instances, each wired to its own Vue.
 */
export const WORKBENCH_MODULE_MARKER = 'histoire-workbench'

const MARKER_RE = new RegExp(`[?&]${WORKBENCH_MODULE_MARKER}(?:&|$)`)
/** Specifiers whose state must be the workbench's Vue instance. */
const VUE_RUNTIME_IDS = new Set(['vue', '@vue/runtime-dom', '@vue/runtime-core', '@vue/reactivity'])
/** Script modules that can import `vue`; styles, assets and JSON never need marking. */
const MARKABLE_RE = /\.(?:[cm]?[jt]sx?|vue)$/
/** Sub-requests that are not script modules even when the file is (`?raw`, SFC styles...). */
const NON_SCRIPT_QUERY_RE = /[?&](?:raw|url|inline|worker|sharedworker|type=style)(?:&|=|$)/
/** Package specifiers (`pkg`, `@scope/pkg/sub`), excluding `virtual:` style protocols. */
const BARE_RE = /^(?![a-z]:[\\/])[\w@](?!.*?:\/\/)/i
/** Scanner placeholder: non-absolute ids are externalized and never optimized. */
const SCAN_SKIP_ID = '\0histoire-workbench-skip'

/**
 * Whether a module id belongs to a workbench plugin client graph.
 * @param id Resolved module id, possibly with a query.
 */
export function hasWorkbenchMarker(id: string): boolean {
  return MARKER_RE.test(id)
}

/**
 * Adds the marker right after `?`: Vite and framework plugins match suffixes such as
 * `lang.ts` or `.css` at the end of ids, so the marker must never be last.
 * @param id Resolved module id.
 */
export function addWorkbenchMarker(id: string): string {
  if (hasWorkbenchMarker(id)) return id
  const query = id.indexOf('?')
  return query === -1 ? `${id}?${WORKBENCH_MODULE_MARKER}` : `${id.slice(0, query + 1)}${WORKBENCH_MODULE_MARKER}&${id.slice(query + 1)}`
}

/**
 * Strips query and hash.
 * @param id Module id.
 */
function cleanId(id: string): string {
  return id.replace(/[?#].*$/, '')
}

/**
 * Package name of a bare specifier (`@scope/name/sub` gives `@scope/name`).
 * @param id Bare specifier.
 */
function packageName(id: string): string {
  return id.split('/').slice(0, id.startsWith('@') ? 2 : 1).join('/')
}

/**
 * Directory of the package `name` owning `file`: the nearest ancestor manifest with that
 * name (works when `exports` hides `package.json`), or `null`.
 * @param file File inside the package.
 * @param name Package name.
 */
function packageRoot(file: string, name: string): string | null {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    try {
      if (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name === name) return dir
    }
    catch {}
  }
  return null
}

/** Dev dependency optimizer surface used for installed plugin packages. */
interface DepsOptimizerLike {
  /** Optimizer options (`noDiscovery`, `exclude`). */
  options: { noDiscovery?: boolean, exclude?: string[] }
  /** Registers a bare import for prebundling; returns its (pending) optimized entry. */
  registerMissingImport: (id: string, resolved: string) => unknown
  /** Browser id of an optimized entry. */
  getOptimizedDepId: (info: any) => string
}

/**
 * Prebundles a non-Vue package imported by an installed workbench plugin package.
 *
 * Vite never optimizes imports made from files inside `node_modules`, so a plugin package
 * installed from npm that imports a CommonJS dependency (React views: `react`,
 * `react-dom/client`) would get it served raw and fail in the browser. Imports from plugin
 * files outside `node_modules` keep Vite's own discovery. The optimizer keys entries by
 * specifier, so a project importing the same package shares one prebundle.
 * @param environment Dev environment of the request.
 * @param id Bare specifier.
 * @param importer Marked importer.
 * @param file File the specifier resolves to, if any.
 * @returns The optimized id, or `null` to let Vite resolve normally.
 */
function optimizeInstalledImport(environment: unknown, id: string, importer: string, file: string | undefined): string | null {
  const optimizer = (environment as { depsOptimizer?: DepsOptimizerLike }).depsOptimizer
  const resolved = file && cleanId(file)
  if (!optimizer || !resolved || !isAbsolute(resolved) || !/\/node_modules\//.test(cleanId(importer))) return null
  if (optimizer.options.noDiscovery || optimizer.options.exclude?.includes(packageName(id)) || !/\.[cm]?js$/.test(resolved)) return null
  return optimizer.getOptimizedDepId(optimizer.registerMissingImport(id, resolved))
}

/**
 * Creates the `resolveId` hook routing Vue in workbench plugin client graphs to the
 * workbench's vendored copy (see {@link WORKBENCH_MODULE_MARKER}).
 *
 * Inside a marked graph:
 * - `vue` and its stateful runtime packages resolve exactly as the prebuilt workbench
 *   resolves `@histoire/vendors/vue`, so the browser loads one URL and one instance.
 *   Other `vue/*` subpaths are rejected: the vendored build is runtime-only.
 * - `@histoire/controls/vue` resolves to the controls copy bundled into the workbench.
 * - Relative and absolute script imports stay marked.
 * - Packages declaring a `vue` dependency (and `@histoire/plugin-kit/vue*`) resolve
 *   without the dependency optimizer and stay marked: a prebundle would embed the
 *   project's Vue, or fail in projects without one.
 * - Other packages (React, utilities) resolve normally and are shared with stories.
 *
 * Workbench and vendor packages are never marked: they already use the vendored Vue.
 */
export function createWorkbenchVueResolver(): NonNullable<VitePlugin['resolveId']> {
  const appIndex = join(resolveHistoireAppBundledDir(), 'index.js')
  const appRoot = dirname(dirname(resolveHistoireAppBundledDir()))
  const vendorVue = normalize(realpathSync(createRequire(appIndex).resolve('@histoire/vendors/vue')))
  const sharedRoots = [appRoot, packageRoot(vendorVue, '@histoire/vendors')].filter((root): root is string => !!root)
  const bundledControls = join(resolveHistoireAppBundledDir(), 'packages/histoire-controls/src/index.js')
  const resolvers = new WeakMap<ResolvedConfig, ReturnType<ResolvedConfig['createResolver']>>()
  const vueDependentPackages = new Map<string, boolean>()
  // Optimizer scans see unmarked file ids, so scanned plugin files are tracked here.
  const scannedWorkbenchFiles = new Set<string>()

  /**
   * Whether the package owning `file` declares a Vue dependency (memoized per root).
   * @param file Resolved file inside the package.
   * @param name Package name.
   */
  function dependsOnVue(file: string, name: string): boolean {
    const root = packageRoot(file, name)
    if (!root) return false
    let cached = vueDependentPackages.get(root)
    if (cached === undefined) {
      try {
        const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
        cached = ['dependencies', 'peerDependencies', 'optionalDependencies'].some(field => manifest[field]?.vue !== undefined)
      }
      catch {
        cached = false
      }
      vueDependentPackages.set(root, cached)
    }
    return cached
  }

  /**
   * Whether a resolved id gets its own marked instance.
   * @param id Resolved id.
   * @param config Environment config.
   */
  function isMarkable(id: string, config: ResolvedConfig): boolean {
    const file = cleanId(id)
    if (id.startsWith('\0') || !isAbsolute(file) || !MARKABLE_RE.test(file) || NON_SCRIPT_QUERY_RE.test(id)) return false
    // Prebundled dependencies cannot be re-resolved; workbench packages already share Vue.
    return ![normalize(config.cacheDir), ...sharedRoots].some(root => file.startsWith(`${root}/`))
  }

  return {
    // Before aliases and Vite's resolver, which would hand out the project's `vue`.
    order: 'pre',
    async handler(id, importer, options) {
      if (!importer) return null
      const scan = (options as { scan?: boolean }).scan === true
      const isManifest = importer.startsWith(RESOLVED_WORKBENCH_PLUGINS_ID)
      if (!isManifest && !(scan ? scannedWorkbenchFiles.has(cleanId(importer)) : hasWorkbenchMarker(importer))) return null
      const config = this.environment.config

      if (id.startsWith('vue/')) this.error(`[histoire] workbench plugin module ${cleanId(importer)} imports "${id}"; workbench Vue components can only import "vue" (the workbench ships the runtime-only build)`)
      const redirect = VUE_RUNTIME_IDS.has(id)
        ? '@histoire/vendors/vue'
        : id === '@histoire/controls/vue' && existsSync(bundledControls) ? bundledControls : null
      if (redirect) {
        // Resolved from the workbench's own files: same id, same URL, one instance.
        return scan ? { id: SCAN_SKIP_ID, external: true } : this.resolve(redirect, appIndex, { skipSelf: true })
      }

      if (BARE_RE.test(id)) {
        const name = packageName(id)
        let resolve = resolvers.get(config)
        if (!resolve) resolvers.set(config, resolve = config.createResolver())
        // Resolved without the optimizer: checking first must not register a prebundle.
        const file = await resolve(id, cleanId(importer))
        const vueDependent = !!file && isAbsolute(cleanId(file)) && (name === '@histoire/plugin-kit' ? /^@histoire\/plugin-kit\/vue(?:\/|$)/.test(id) : dependsOnVue(cleanId(file), name))
        if (!vueDependent) return scan ? null : optimizeInstalledImport(this.environment, id, importer, file)
        if (scan) return { id: SCAN_SKIP_ID, external: true }
        return isMarkable(file!, config) ? addWorkbenchMarker(file!) : file
      }

      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true })
      if (!resolved || resolved.external || !isMarkable(resolved.id, config)) return resolved
      if (scan) {
        scannedWorkbenchFiles.add(cleanId(resolved.id))
        return resolved
      }
      return { ...resolved, id: addWorkbenchMarker(resolved.id) }
    },
  }
}
