/**
 * Generation tokens. Each scope (host, plugin, selection, frame, action) owns one
 * `AbortController`. Operations capture the scope when they start and drop their result
 * when `active` turned false meanwhile, so a stale generation can never register,
 * update or publish into the current one.
 */

/** One generation of an owner; retired once, never reactivated. */
export interface Scope {
  /** Aborted when this scope or any parent retires. */
  readonly signal: AbortSignal
  /** `false` once retired; captured operations check it before applying results. */
  readonly active: boolean
  /** Retires this scope and every child; idempotent. */
  retire: () => void
  /** Creates a child scope retired together with this one. */
  child: () => Scope
}

/**
 * Creates a scope that retires when any parent signal aborts.
 * Parent listeners are removed on retirement so long-lived parents do not accumulate them.
 * @param parents Parent signals; `undefined` entries are ignored.
 */
export function createScope(...parents: ReadonlyArray<AbortSignal | undefined>): Scope {
  const controller = new AbortController()
  const linked = parents.filter((signal): signal is AbortSignal => signal !== undefined)

  /** Aborts once and detaches from parents. */
  function retire(): void {
    if (controller.signal.aborted) return
    for (const parent of linked) parent.removeEventListener('abort', retire)
    controller.abort()
  }

  if (linked.some(parent => parent.aborted)) {
    controller.abort()
  }
  else {
    for (const parent of linked) parent.addEventListener('abort', retire, { once: true })
  }

  return {
    signal: controller.signal,
    get active() {
      return !controller.signal.aborted
    },
    retire,
    child: () => createScope(controller.signal),
  }
}
