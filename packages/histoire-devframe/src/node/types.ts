import type { Exposure } from '../shared/services.js'

export type { Exposure } from '../shared/services.js'

/** Host-verified document metadata; SDK retains its own bridge identity. */
export interface LiveIdentity {
  projectId: string
  sourceId: string
  epoch: string
  revision: string
  mountId: string
  runtimeId: string
  target: { storyId: string, variantId: string }
}

/** Trusted host wrapper for exactly one authenticated transport connection. */
export interface LivePeer {
  /** Dispatch one finite operation to this connection, propagating abort. */
  call: (name: string, input: unknown, signal: AbortSignal) => Promise<unknown>
  /** Dispatch a reversible highlight and retain its exact cleanup until authorization finishes. */
  callHighlight?: (name: string, input: unknown, signal: AbortSignal) => Promise<{ value: unknown, finish: (accepted: boolean) => Promise<void> }>
  /** Notify the remote attachment that its authority has ended. */
  retire?: () => void | Promise<unknown>
}

/** Credential-free attachment exposed to authorized callers. */
export interface LiveAttachment {
  attachmentId: string
  sourceUrl: string
  owner: Pick<LiveIdentity, 'sourceId' | 'epoch' | 'revision' | 'runtimeId' | 'target'>
  scopes: Exposure[]
}

/** Host policy resolves transport identity and verifies document authority. */
export interface BrokerOptions<P extends LivePeer> {
  identifyPeer: (peer: P) => string | undefined | Promise<string | undefined>
  verifyAttachment: (peer: P, identity: LiveIdentity, sourceUrl: string) => { identity: LiveIdentity, scopes: readonly Exposure[] } | Promise<{ identity: LiveIdentity, scopes: readonly Exposure[] }>
  /** Revalidate host ownership before and after asynchronous work. */
  isCurrent: (peer: P, identity: LiveIdentity) => boolean | Promise<boolean>
  /** Increment synchronously for every policy or document ownership change. */
  authorityVersion: () => number
  /** Observe retirement to release transport-owned bookkeeping. */
  onRetire?: (peer: P, attachmentId: string) => void
  allowSource: (url: string) => boolean
  authorize: Authorization
  leaseMs?: number
  timeoutMs?: number
}

/** Host policy runs for every discovery and operation. */
export type Authorization = (input: { principal: string, attachment: LiveAttachment & { principal: string }, identity: LiveIdentity, capability: 'discover' | Exposure }) => boolean | Promise<boolean>
