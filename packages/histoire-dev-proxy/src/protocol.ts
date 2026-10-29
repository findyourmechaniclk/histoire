/** Public lifecycle, also used by SDK compatibility adapters. */
export type RuntimeStatus = 'starting' | 'ready' | 'restarting' | 'failed' | 'closed'

/** Configuration bytes captured at evaluation, encoded only for private IPC. */
export interface WatchInput {
  /** Absolute local configuration/dependency path. */
  file: string
  /** Source shown in terminal diagnostics. */
  source: string
  /** Base64 bytes; null records a missing file. */
  bytes: string | null
}

/** Browser-safe snapshot; excludes backend address, process IDs and secrets. */
export interface PublicState {
  /** Current availability. */
  status: RuntimeStatus
  /** Opaque process generation. */
  generation: string
  /** Current application mount. */
  base: string
  /** Short failure detail, when startup failed. */
  error?: string
}

/** Parent starts one runtime exactly once and requests graceful winddown. */
export type ParentMessage = { type: 'start', generation: string, publicOrigin: string, options: Record<string, unknown>, token?: string } | { type: 'shutdown' }

/** Runtime reports observations; only parent decides public availability/restarts. */
export type ChildMessage =
  | { type: 'watch', generation: string, inputs: WatchInput[], complete?: boolean }
  | { type: 'ready', generation: string, target: string, base: string, open?: boolean | string }
  | { type: 'failed', generation: string, error: string }

/** Accept finite, generation-scoped frames before dispatching across IPC. */
export function isChildMessage(value: unknown): value is ChildMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  if (typeof message.generation !== 'string' || message.generation.length > 100) return false
  if (message.type === 'failed') return typeof message.error === 'string' && message.error.length <= 4096
  if (message.type === 'ready') return typeof message.target === 'string' && /^http:\/\/127\.0\.0\.1:\d+$/.test(message.target) && typeof message.base === 'string' && message.base.startsWith('/') && !message.base.startsWith('//')
  return message.type === 'watch' && Array.isArray(message.inputs) && message.inputs.length <= 10000 && message.inputs.every(input => input && typeof input.file === 'string' && typeof input.source === 'string' && (input.bytes === null || typeof input.bytes === 'string'))
}
