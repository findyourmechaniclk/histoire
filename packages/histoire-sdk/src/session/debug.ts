import type { HistoireDebug, HistoireDebugPage, HistoireInspectionOwner } from '@histoire/protocol'
import type { SessionContext } from './context.js'
import { createDebugBuffer, HISTOIRE_ERROR_CODES, HistoireSdkError, sameInspectionOwner } from '@histoire/protocol'

/** Captured transport and authority; stop must never acquire a replacement runtime. */
export interface DiagnosticLease {
  /** Captured public owner, also checked against each result. */
  owner: HistoireInspectionOwner
  /** Whether this exact source, attachment, document and permission remain active. */
  current: () => boolean
  /** Execute against the captured transport, including cleanup after withdrawal. */
  invoke: (action: 'start' | 'read' | 'stop', observationId: string, afterSequence?: number, signal?: AbortSignal) => Promise<HistoireDebugPage>
}

/** Avoid retaining a retired session through V8's lazy asynchronous error stack. */
function diagnosticClosureError(code: 'SOURCE_UNAVAILABLE' | 'RUNTIME_CHANGED' | 'TIMEOUT', message: string): HistoireSdkError {
  const error = new HistoireSdkError(code, message)
  error.stack = undefined
  return error
}

/** Keep public failure identity without retaining runtime frames through a lazy stack. */
function detachReadyError(value: unknown): Error {
  const code = value instanceof Error ? Object.getOwnPropertyDescriptor(value, 'code')?.value : undefined
  const error = value instanceof Error && typeof code === 'string' && (HISTOIRE_ERROR_CODES as readonly string[]).includes(code)
    ? new HistoireSdkError(code as import('@histoire/protocol').HistoireErrorCode, value.message, value instanceof HistoireSdkError ? value.details : undefined)
    : value instanceof Error ? Object.assign(new Error(value.message), { name: value.name }) : new Error('Diagnostic observation failed.')
  error.stack = undefined
  return error
}

/** Detach release closure after use so retained handles cannot retain the session. */
function diagnosticHandle(ready: Promise<void>, closed: Promise<void>, initialRelease: () => Promise<void>) {
  let release: (() => Promise<void>) | undefined = initialRelease
  let closing: Promise<void> | undefined
  return {
    handle: {
      ready,
      closed,
      unsubscribe(): Promise<void> {
        if (closing) return closing
        const run = release!
        release = undefined
        closing = run()
        return closing
      },
    },
    /** Automatic retirement also releases the handle's session reference. */
    detach(completion: Promise<void>): void {
      release = undefined
      closing ??= completion
    },
  }
}

/** Share one remote observation and its cursor among listeners of the same SDK session. */
export function createSessionDebug(context: SessionContext, acquire: () => DiagnosticLease): HistoireDebug {
  const buffer = createDebugBuffer()
  let nextId = 0
  interface Listener { callback?: (page: HistoireDebugPage) => void, active: boolean, closed: PromiseWithResolvers<void>, detach: (completion: Promise<void>) => void }
  interface Stream {
    lease: DiagnosticLease
    id: string
    listeners: Set<Listener>
    abort: AbortController
    cursor: number
    attempted: boolean
    active: boolean
    ready: Promise<void>
    closing?: Promise<void>
    timer?: ReturnType<typeof setTimeout>
    changed: () => void
  }
  let stream: Stream | undefined
  let retained: DiagnosticLease | undefined
  /** Retained evidence is readable only while its captured authority remains current. */
  function pruneRetention(): void {
    if (retained && !retained.current()) {
      buffer.clear()
      retained = undefined
      context.listeners.delete(pruneRetention)
    }
  }
  /** Discard local evidence without recycling its sequence identities. */
  function clearRetention(): void {
    buffer.clear()
    retained = undefined
    context.listeners.delete(pruneRetention)
  }
  /** Stop polling immediately and reserve one cleanup promise before awaiting registration. */
  function close(current: Stream, error?: HistoireSdkError): Promise<void> {
    if (current.closing) return current.closing
    const completion = Promise.withResolvers<void>()
    current.closing = completion.promise
    void current.closing.catch(() => {})
    current.active = false
    if (stream === current) stream = undefined
    context.listeners.delete(current.changed)
    for (const listener of current.listeners) {
      listener.active = false
      listener.callback = undefined
      listener.detach(current.closing)
      if (error) listener.closed.reject(error)
      else listener.closed.resolve()
    }
    current.listeners.clear()
    clearTimeout(current.timer)
    current.abort.abort()
    if (!current.attempted) {
      completion.resolve()
      return current.closing
    }
    // Stop immediately, then join registration: if the first stop raced ahead of
    // registration, retry after settlement using the same captured owner and ID.
    const early = Promise.resolve().then(() => current.lease.invoke('stop', current.id)).then(() => true, () => false)
    const cleanup = (async () => {
      const [stopped] = await Promise.all([early, current.ready.catch(() => {})])
      if (!stopped) {
        try {
          await current.lease.invoke('stop', current.id)
        }
        catch { throw diagnosticClosureError('SOURCE_UNAVAILABLE', 'Diagnostic cleanup could not be confirmed.') }
      }
    })()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(diagnosticClosureError('TIMEOUT', 'Diagnostic cleanup could not be confirmed.')), 5000)
    })
    void Promise.race([cleanup, timeout]).then(completion.resolve, completion.reject).finally(() => clearTimeout(timer))
    return current.closing
  }
  /** Publish only after rechecking the captured owner and subscriber lifetime. */
  function accept(current: Stream, page: HistoireDebugPage): void {
    if (!current.active || !current.lease.current()) {
      pruneRetention()
      void close(current, diagnosticClosureError('RUNTIME_CHANGED', 'Diagnostic owner changed.'))
      return
    }
    pruneRetention()
    let previous = current.cursor
    for (const entry of page.items) {
      if (!entry.owner || !sameInspectionOwner(entry.owner, current.lease.owner) || entry.sequence <= previous || entry.sequence > page.nextSequence) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid diagnostic owner or sequence.')
      previous = entry.sequence
    }
    if (page.nextSequence < previous) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid diagnostic cursor.')
    // Remote cumulative eviction includes rows already delivered. Only cursor gaps
    // represent evidence this SDK missed; count them once in local chronology.
    let cursor = current.cursor
    for (const { sequence, ...entry } of page.items) {
      if (sequence <= cursor) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid diagnostic sequence.')
      buffer.drop(sequence - cursor - 1)
      buffer.add(entry)
      cursor = sequence
    }
    if (page.nextSequence < cursor) throw new HistoireSdkError('INVALID_ARGUMENT', 'Invalid diagnostic cursor.')
    buffer.drop(page.nextSequence - cursor)
    current.cursor = page.nextSequence
    if (page.items.length) {
      retained = current.lease
      context.listeners.add(pruneRetention)
    }
    const snapshot = context.copy(buffer.read())
    for (const listener of current.listeners) {
      if (!current.active || !current.lease.current()) {
        void close(current, diagnosticClosureError('RUNTIME_CHANGED', 'Diagnostic owner changed.'))
        break
      }
      if (listener.active) {
        try {
          listener.callback?.(snapshot)
        }
        catch {}
      }
    }
  }
  /** Poll the same captured runtime; failed or retired work cannot schedule another poll. */
  async function poll(current: Stream): Promise<void> {
    try {
      const page = await current.lease.invoke('read', current.id, current.cursor, current.abort.signal)
      accept(current, page)
      if (current.active && current.lease.current()) current.timer = setTimeout(() => void poll(current), 250)
    }
    catch {
      if (current.active) {
        clearRetention()
        void close(current, diagnosticClosureError('SOURCE_UNAVAILABLE', 'Diagnostic observation lost.'))
      }
    }
  }
  return {
    /** A local read does not start instrumentation. */
    getSnapshot: (options?: { afterSequence?: number, limit?: number }) => {
      pruneRetention()
      return context.copy(buffer.read(options))
    },
    /** Clear local evidence without reusing sequence identities. */
    clear: () => clearRetention(),
    /** One listener handle owns one reference to the current observation. */
    subscribe(callback: (page: HistoireDebugPage) => void) {
      if (typeof callback !== 'function') throw new HistoireSdkError('INVALID_ARGUMENT', 'Diagnostic listener must be a function.')
      context.assertConnected()
      pruneRetention()
      if (stream && !stream.lease.current()) void close(stream, diagnosticClosureError('RUNTIME_CHANGED', 'Diagnostic owner changed.'))
      if (!stream) {
        const lease = acquire()
        const current: Stream = {
          lease,
          id: `${context.sessionId}:debug:${++nextId}`,
          listeners: new Set(),
          abort: new AbortController(),
          cursor: 0,
          attempted: false,
          active: true,
          ready: Promise.resolve(),
          changed: () => {},
        }
        stream = current
        current.changed = () => {
          if (!current.lease.current()) void close(current, diagnosticClosureError('RUNTIME_CHANGED', 'Diagnostic owner changed.'))
        }
        context.listeners.add(current.changed)
        // Defer start so immediate unsubscribe can cancel before any runtime work.
        current.ready = Promise.resolve().then(async () => {
          if (!current.active || !current.lease.current()) throw new HistoireSdkError('CANCELLED', 'Diagnostic observation cancelled.')
          current.attempted = true
          const page = await lease.invoke('start', current.id, undefined, current.abort.signal)
          if (!current.active || !lease.current()) throw new HistoireSdkError('CANCELLED', 'Diagnostic observation cancelled.')
          accept(current, page)
          if (current.active) current.timer = setTimeout(() => void poll(current), 250)
        }).catch((error: unknown) => { throw detachReadyError(error) })
        void current.ready.catch(() => {
          if (current.active) {
            clearRetention()
            void close(current, diagnosticClosureError('SOURCE_UNAVAILABLE', 'Diagnostic observation lost.'))
          }
        })
      }
      const current = stream
      const closed = Promise.withResolvers<void>()
      void closed.promise.catch(() => {})
      const listener: Listener = { callback, active: true, closed, detach: () => {} }
      current.listeners.add(listener)
      const handle = diagnosticHandle(current.ready, closed.promise, () => {
        listener.active = false
        listener.callback = undefined
        listener.closed.resolve()
        current.listeners.delete(listener)
        return current.listeners.size ? Promise.resolve() : close(current)
      })
      listener.detach = handle.detach
      return handle.handle
    },
  } as unknown as HistoireDebug
}
