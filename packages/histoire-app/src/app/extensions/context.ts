import type { HistoireSession } from '@histoire/sdk'

/** Public SDK session methods the root context reads; never app stores. */
export type ContextSession = Pick<HistoireSession, 'getSnapshot' | 'subscribe' | 'catalog'>

// The standalone workbench and native hosts share plugin-kit's session context: same
// selection/source generation scopes, same frozen catalog and selection values.
export { createSessionContext as createRootContext } from '@histoire/plugin-kit'
export type { SessionContext as RootContext, SessionContextOptions as RootContextOptions } from '@histoire/plugin-kit'
