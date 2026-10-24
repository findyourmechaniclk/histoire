import type { ActionRun } from '../types/actions.js'
import type { FrameMenuChild } from '../types/menus.js'
import type { Registry, RegistryEntry } from './registry.js'
import { createScope } from './generation.js'

/** Action resolved from a runnable id, with the registry entry owning it. */
export interface RunnableAction {
  /** Owning registry entry (scope and attribution). */
  entry: RegistryEntry
  /** Plugin action. */
  run: ActionRun<unknown>
}

/**
 * Resolves a runnable id: a contribution with a `run`, or a frame-menu child addressed as
 * `${itemId}:${childId}` (for example `acme:export:json`). Local ids never contain `:`, so a
 * child id can never collide with a contribution id. Children share their item's owner scope.
 * @param registry Host registry.
 * @param id Qualified contribution id or frame-menu child id.
 */
export function resolveRunnable(registry: Registry, id: string): RunnableAction | undefined {
  const entry = registry.get(id)
  if (entry) {
    const run = (entry.contribution as { run?: unknown }).run
    return typeof run === 'function' ? { entry, run: run as ActionRun<unknown> } : undefined
  }
  const separator = id.lastIndexOf(':')
  const parent = separator > 0 ? registry.get(id.slice(0, separator)) : undefined
  if (parent?.contribution.kind !== 'frame-menu.item') return undefined
  const childId = id.slice(separator + 1)
  const child = (parent.contribution.children as readonly FrameMenuChild[] | undefined)?.find(item => item.id === childId)
  return typeof child?.run === 'function' ? { entry: parent, run: child.run as ActionRun<unknown> } : undefined
}

/** Inputs of one action invocation. */
export interface RunActionOptions<C> {
  /** Plugin action. */
  run: ActionRun<C>
  /** Target scope captured when the invocation started. */
  context: C
  /** Scopes whose retirement aborts the action (owner, host, caller scope). */
  signals: ReadonlyArray<AbortSignal | undefined>
  /** Receives the action error when it settled while still current. */
  onError: (error: unknown) => void
}

/**
 * Framework-neutral action runner core. The action runs under a fresh scope linked to every
 * given signal; the promise doubles as pending state for the invoking surface.
 * Settlement after any linked scope retired is discarded: no error, no diagnostic.
 * The action scope retires once the action settles, releasing parent listeners.
 * @param options Action, captured context, linked signals and error sink.
 */
export async function runAction<C>(options: RunActionOptions<C>): Promise<void> {
  const scope = createScope(...options.signals)
  if (!scope.active) return
  try {
    await options.run(options.context, { signal: scope.signal })
  }
  catch (error) {
    // A retired generation must not publish errors into the current one.
    if (!scope.active) return
    options.onError(error)
    throw error
  }
  finally {
    scope.retire()
  }
}
