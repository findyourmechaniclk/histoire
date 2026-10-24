declare module 'virtual:$histoire-commands' {
  import type { ClientCommand } from '@histoire/shared'

  export const registeredCommands: ClientCommand[]
}

declare module 'virtual:$histoire-workbench-plugins' {
  import type { HistoireJsonValue } from '@histoire/protocol'

  /** Lazy plugin workbench (`client`) entries, in config order; dev-only entries are absent from static builds. */
  export const workbenchPlugins: Array<{
    /** Plugin id from the Node descriptor. */
    id: string
    /** Extension contract version. */
    apiVersion: 1
    /** Validated browser-visible JSON options. */
    options: HistoireJsonValue | undefined
    /** Imports the entry module; its default export is the plugin definition. */
    load: () => Promise<{ default: unknown }>
  }>
}

declare module 'virtual:$histoire-frame-plugins' {
  import type { HistoireJsonValue } from '@histoire/protocol'

  /** Lazy plugin frame entries, in config order; dev-only entries are absent from static builds. */
  export const framePlugins: Array<{
    /** Plugin id from the Node descriptor. */
    id: string
    /** Extension contract version. */
    apiVersion: 1
    /** Validated browser-visible JSON options. */
    options: HistoireJsonValue | undefined
    /** Imports the entry module; its default export is the frame plugin definition. */
    load: () => Promise<{ default: unknown }>
  }>
}

declare module 'virtual:$histoire-build-info' {
  import type { HistoireBuildInfo } from '@histoire/shared'

  export const buildInfo: HistoireBuildInfo
  /** Observes metadata replacements until the captured workbench detaches. */
  export function onBuildInfoUpdate(listener: (value: HistoireBuildInfo) => void): () => void
}

declare module 'virtual:*';
