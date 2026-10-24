/** Asset entry as written in `quasar.config` (`boot`, `css`). */
export type QuasarAssetEntry = string | false | null | undefined | {
  /** Path relative to `src/<folder>`, or `~package/path`. */
  path: string
  /** Set to `false` for server-only entries. */
  client?: boolean
  /** Set to `false` for client-only entries. */
  server?: boolean
}

/** Subset of the user `quasar.config` result used by Histoire. */
export interface RawQuasarConfig {
  /** Boot files, run in order. */
  boot?: QuasarAssetEntry[]
  /** Global stylesheets. */
  css?: QuasarAssetEntry[]
  /** `@quasar/extras` assets (fonts, icon sets). */
  extras?: string[]
  /** `@quasar/extras/animate` animations, or `'all'`. */
  animations?: string[] | 'all'
  /** Quasar framework options. */
  framework?: {
    /** Quasar config (brand colors, plugin defaults...). */
    config?: Record<string, unknown>
    /** Components to register (when not auto-imported). */
    components?: string[]
    /** Directives to register. */
    directives?: string[]
    /** Quasar plugins (Notify, Dialog...). */
    plugins?: string[]
    /** Language pack name or path. */
    lang?: string
    /** Icon set name or path. */
    iconSet?: string
    /** Import the flex CSS addon. */
    cssAddon?: boolean
  }
  /** Overridden source file locations. */
  sourceFiles?: {
    /** Store factory path, without or with extension. */
    store?: string
    /** Router factory path, without or with extension. */
    router?: string
  }
}

/** Quasar framework options passed to `app.use(Quasar, ...)`. */
export interface ResolvedQuasarFramework {
  /** Quasar config, serialized into the generated options. */
  config: Record<string, unknown>
  /** Component names imported from `quasar`. */
  components: string[]
  /** Directive names imported from `quasar`. */
  directives: string[]
  /** Plugin names imported from `quasar`. */
  plugins: string[]
  /** Import path of the language pack. */
  lang?: string
  /** Import path of the icon set. */
  iconSet?: string
}

/** `quasar.config` resolved to what the story app setup needs. */
export interface ResolvedQuasarConfig {
  /** Client boot file import paths, in order. */
  boot: string[]
  /** Client stylesheet import paths, in order. */
  css: string[]
  /** `@quasar/extras` asset names. */
  extras: string[]
  /** `@quasar/extras/animate` animation names. */
  animations: string[]
  /** Import the flex CSS addon. */
  cssAddon: boolean
  /** `sass` when the project customizes Quasar Sass variables. */
  quasarSrcExt: 'css' | 'sass'
  /** Options for `app.use(Quasar)`. */
  framework: ResolvedQuasarFramework
  /** Absolute POSIX path of the store (Pinia) factory, if the project has one. */
  storeFile?: string
  /** Project uses Vue Router; boot files then receive a router. */
  hasRouter: boolean
}
