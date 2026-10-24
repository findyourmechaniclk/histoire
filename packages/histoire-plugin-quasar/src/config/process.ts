/* eslint-disable no-console -- buffers Quasar CLI console output during its config load */
import { AsyncLocalStorage } from 'node:async_hooks'

/** Console methods buffered during a load. */
type ConsoleMethod = 'log' | 'info' | 'warn' | 'error'

/** State of one Quasar CLI load. */
interface QuasarScope {
  /** Project root, shown as cwd to code running in the load. */
  root: string
  /** Console output buffered during the load. */
  output: Array<{ method: ConsoleMethod, args: unknown[] }>
  /**
   * Cleared when the load ends: timers or watchers it created keep the
   * async context, but must then behave like regular code.
   */
  active: boolean
}

/** Original and patched process/console globals. */
interface Patches {
  /** Globals before patching. */
  original: { cwd: typeof process.cwd, exit: typeof process.exit, console: Record<ConsoleMethod, (...args: unknown[]) => void> }
  /** Wrappers installed by us, to restore only what we still own. */
  wrappers: { cwd: typeof process.cwd, exit: typeof process.exit, console: Record<ConsoleMethod, (...args: unknown[]) => void> }
  /** Loads in flight. */
  users: number
}

/** Thrown in place of Quasar CLI's `process.exit`; Quasar may log it before exiting again. */
export class QuasarCliExitError extends Error {
  /** @param code Exit code Quasar CLI requested. */
  constructor(code?: number) {
    super(`Quasar CLI failed (exit code ${code ?? 0}), see the messages above.`)
    this.name = 'QuasarCliExitError'
  }
}

/** Buffered methods, in replay order. */
const consoleMethods: ConsoleMethod[] = ['log', 'info', 'warn', 'error']

/** Quasar's `warning()`/`error()` loggers print with `console.log` and a WARNING/ERROR pill. */
const loggedProblemRE = /\s(?:WARNING|ERROR)\s/

/** Current Quasar load, propagated through async continuations. */
const storage = new AsyncLocalStorage<QuasarScope>()

/** Installed patches while at least one load is in flight. */
let patches: Patches | undefined

/** Scope of the running load, if code runs inside an active one. */
function activeScope(): QuasarScope | undefined {
  const scope = storage.getStore()
  return scope?.active ? scope : undefined
}

/**
 * Patch process/console globals so they behave differently only for code
 * running inside an active Quasar scope (async continuations included). Code
 * outside keeps the original behavior, so Histoire never changes the process cwd.
 */
function installPatches() {
  if (patches) {
    patches.users++
    return
  }
  const original: Patches['original'] = {
    cwd: process.cwd,
    exit: process.exit,
    console: Object.fromEntries(consoleMethods.map(method => [method, console[method]])) as Patches['original']['console'],
  }
  const wrappers: Patches['wrappers'] = {
    cwd: () => activeScope()?.root ?? original.cwd.call(process),
    exit: ((code?: number) => {
      // Quasar CLI's `fatal()` exits on config, App Extension or `index.html`
      // problems, which would kill Histoire's server.
      if (activeScope()) throw new QuasarCliExitError(code)
      return original.exit.call(process, code)
    }) as typeof process.exit,
    console: Object.fromEntries(consoleMethods.map(method => [method, (...args: unknown[]) => {
      const scope = activeScope()
      if (scope) scope.output.push({ method, args })
      else original.console[method](...args)
    }])) as Patches['wrappers']['console'],
  }
  patches = { original, wrappers, users: 1 }
  process.cwd = wrappers.cwd
  process.exit = wrappers.exit
  for (const method of consoleMethods) console[method] = wrappers.console[method]
}

/** Restore the original globals once no load is in flight, unless replaced since. */
function uninstallPatches() {
  if (!patches || --patches.users > 0) return
  const { original, wrappers } = patches
  if (process.cwd === wrappers.cwd) {
    process.cwd = original.cwd
  }
  else {
    // A library loaded during the load (e.g. graceful-fs) may have wrapped
    // `process.cwd` with a cache holding the project root; it clears that
    // cache on `chdir`. Changing to the current folder moves nothing.
    try {
      process.chdir(original.cwd.call(process))
    }
    catch {
      // `chdir` is unavailable in worker threads.
    }
  }
  if (process.exit === wrappers.exit) process.exit = original.exit
  for (const method of consoleMethods) {
    if (console[method] === wrappers.console[method]) console[method] = original.console[method]
  }
  patches = undefined
}

/** Whether buffered output is shown after a successful load. */
function isProblem({ method, args }: QuasarScope['output'][number]) {
  return method === 'warn' || method === 'error' || (typeof args[0] === 'string' && loggedProblemRE.test(args[0]))
}

/**
 * Run Quasar CLI code as if Histoire had started in the project folder:
 * `process.cwd()` (and `path.resolve`) returns `root` for code in this load,
 * including the user config, App Extensions and Vite plugin factories.
 * Relative `fs` paths still use the real cwd.
 *
 * Quasar progress output is dropped on success; warnings and errors are
 * shown. On failure, everything is shown before the error, and Quasar's
 * `process.exit` becomes a thrown {@link QuasarCliExitError}.
 */
export async function runInQuasarScope<T>(root: string, fn: () => Promise<T>): Promise<T> {
  const scope: QuasarScope = { root, output: [], active: true }
  installPatches()
  const print = patches!.original.console
  let failed = false
  try {
    return await storage.run(scope, fn)
  }
  catch (error) {
    failed = true
    throw error
  }
  finally {
    scope.active = false
    for (const entry of scope.output) {
      // The exit error is rethrown to the caller; Quasar logging it is noise.
      if (entry.args.some(arg => arg instanceof QuasarCliExitError)) continue
      if (failed || isProblem(entry)) print[entry.method](...entry.args)
    }
    // Timers left by the load keep this scope alive: don't keep its output too.
    scope.output.length = 0
    uninstallPatches()
  }
}
