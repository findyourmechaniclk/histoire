import type { HistoireDebugEntry } from '@histoire/protocol'

/** Opt-in window observer; function is also emitted into the runtime document. */
export function observeRuntimeDiagnostics(target: Window & { console: Console }, append: (entry: Omit<HistoireDebugEntry, 'sequence'>) => void, dropped: () => void = () => {}) {
  let active = true
  let windowStart = Date.now()
  let count = 0
  const restores: (() => void)[] = []
  const console = target.console
  /** Strip common credential-bearing forms and all URL userinfo, queries and fragments. */
  function redact(value: string): string {
    return value.slice(0, 2048)
      .replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => {
        try {
          const url = new URL(raw)
          return `${url.origin}${url.pathname}`
        }
        catch { return '[url]' }
      })
      .replace(/\b(bearer|basic)\s+[^\s,;]+/gi, '$1 [redacted]')
      .replace(/\b(token|password|passwd|secret|api[_-]?key|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
  }
  /** Render primitives only; never call application object getters or formatters. */
  function text(value: unknown): string {
    if (typeof value === 'string') return redact(value)
    if (value === null || ['undefined', 'number', 'boolean', 'bigint'].includes(typeof value)) return String(value)
    return typeof value === 'function' ? '[function]' : '[object]'
  }
  /** Limit collection work without affecting the observed document. */
  function record(kind: HistoireDebugEntry['kind'], message: string, level?: string): void {
    if (!active) return
    try {
      const timestamp = Date.now()
      if (timestamp - windowStart >= 1000) {
        count = 0
        windowStart = timestamp
      }
      if (++count > 50) {
        dropped()
        return
      }
      append({ kind, message: redact(message).slice(0, 2048), timestamp, monotonicTimeMs: Math.max(0, target.performance?.now() ?? 0), ...(level ? { level } : {}) })
    }
    catch { /* Observation must never change application behavior. */ }
  }
  /** Restore only wrappers still installed by this observer. */
  function close(): void {
    if (!active) return
    active = false
    for (const restore of restores.splice(0).reverse()) {
      try {
        restore()
      }
      catch {}
    }
  }
  try {
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      const original = console[level]
      const wrapper = function (this: unknown, ...args: unknown[]) {
        const result = Reflect.apply(original, this, args)
        try {
          record('console', args.slice(0, 10).map(text).join(' '), level)
        }
        catch {}
        return result
      }
      console[level] = wrapper
      restores.push(() => {
        if (console[level] === wrapper) console[level] = original
      })
    }
    const error = (event: ErrorEvent) => {
      try {
        record('page-error', typeof event.message === 'string' ? event.message : 'Page error')
      }
      catch {}
    }
    const rejection = (event: PromiseRejectionEvent) => {
      try {
        record('unhandled-rejection', text(event.reason))
      }
      catch {}
    }
    target.addEventListener('error', error)
    restores.push(() => target.removeEventListener('error', error))
    target.addEventListener('unhandledrejection', rejection)
    restores.push(() => target.removeEventListener('unhandledrejection', rejection))
    return close
  }
  catch (error) {
    close()
    throw error
  }
}
