/** Quasar CLI normalized config (after App Extension hooks), with overrides. */
export function createCliConfig(overrides: Record<string, any> = {}) {
  return {
    ctx: { appPaths: { appDir: '/project' } },
    boot: [],
    css: [],
    extras: [],
    animations: [],
    framework: { config: {}, components: [], directives: [], plugins: [] },
    sourceFiles: { store: 'src/stores/index', router: 'src/router/index' },
    metaConf: { hasStore: true, css: { quasarSrcExt: 'css' as const } },
    ...overrides,
  }
}
