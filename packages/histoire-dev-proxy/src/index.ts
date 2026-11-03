import type { watchConfiguration } from './config/watcher.js'
import type { PublicState, RuntimeStatus, WatchInput } from './protocol.js'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createRestartCoordinator } from './lifecycle/index.js'
import { startRuntimeChild } from './process/child.js'
import { createProxyHttp } from './server/http.js'
import { listen } from './server/listener.js'

/** Lightweight parent inputs; runtime executable remains an external adapter. */
export interface DevProxyOptions {
  /** Project working directory. */
  root?: string
  /** Explicit config path relative to root. */
  config?: string
  /** Public port; zero asks OS for an ephemeral port. */
  port?: number
  /** Public interface, default localhost. */
  host?: string | boolean
  /** Open public URL once listener binds. */
  open?: boolean
  /** Framework runtime executable owned by proxy. */
  runtime: URL
  /** Serializable runtime-specific CLI options. */
  runtimeOptions?: Record<string, unknown>
  /** Captured credential, never inherited by project config through env. */
  token?: string
  /** Graceful child winddown budget; default 10000ms. */
  shutdownTimeout?: number
  /** Observe public listener before project work begins. */
  onListening?: (url: string) => void
  /** Optional terminal/application observation; receives detached browser-safe state. */
  onStatus?: (state: Readonly<PublicState>) => void
}

/** Bind first; child startup and project imports happen after handle is available. */
export async function startDevProxy(options: DevProxyOptions) {
  const root = resolve(options.root ?? process.cwd())
  let state: PublicState = { status: 'starting', generation: randomUUID(), base: '/' }
  const http = createProxyHttp(() => state, () => restart())
  let url: string
  try {
    url = `${await listen(http.server, options.port ?? 6006, options.host)}/`
  }
  catch (error) {
    await http.close()
    throw error
  }
  let watcher: Awaited<ReturnType<typeof watchConfiguration>> | undefined
  let closed = false
  let opened = false
  let closing: Promise<void> | undefined
  /** Central publication always withdraws unavailable targets first. */
  function publish(status: RuntimeStatus, error?: unknown) {
    if (status !== 'ready') http.setTarget()
    let detail = error === undefined ? undefined : String(error instanceof Error ? error.message : error).split('\n')[0].slice(0, 512)
    if (detail && options.token) detail = detail.replaceAll(options.token, '[credential]')
    state = { ...state, status, ...(detail ? { error: detail } : {}) }
    if (!detail) delete state.error
    http.events.publish()
    options.onStatus?.({ ...state })
  }
  /** Browser opener loads only after initial public listener exists. */
  async function open(path = '/') {
    if (opened || closed) return
    opened = true
    const { default: openBrowser } = await import('open')
    if (!closed) await openBrowser(new URL(path, url).href)
  }
  const controller = createRestartCoordinator({
    interruptStartup: true,
    acquire: async (_signal, isActive) => {
      state = { ...state, generation: randomUUID() }
      http.events.publish()
      let completeInputs: WatchInput[] | undefined
      return startRuntimeChild({
        entry: options.runtime,
        root,
        generation: state.generation,
        publicOrigin: new URL(url).origin,
        options: options.runtimeOptions ?? {},
        token: options.token,
        shutdownTimeout: options.shutdownTimeout,
        onWatch: async (inputs, complete) => {
          if (complete) completeInputs = inputs
          await watcher?.update(inputs, isActive)
        },
        onReady: async () => {
          if (completeInputs) await watcher?.replace(completeInputs, isActive)
        },
        onExit: (error) => {
          if (closed || !isActive()) return
          // Coordinator still owns crashed child as ready; replace it instead of serving dead handle.
          console.error(error.message)
          publish('failed', error)
          void controller.restart().catch(failure => publish('failed', failure))
        },
      })
    },
    isUnsafeCleanup: () => false,
    quarantineCleanupFailures: false,
    withDeadline: promise => promise,
  })
  const off = controller.subscribe((status, runtime) => {
    if (closed) return
    if (status === 'ready' && runtime?.backend) {
      state = { ...state, base: runtime.backend.base }
      http.setTarget(runtime.backend.target)
      if (runtime.backend.open) void open(typeof runtime.backend.open === 'string' ? runtime.backend.open : runtime.backend.base).catch(console.error)
    }
    publish(status)
  })
  const prepared = (async () => {
    options.onListening?.(url)
    if (options.open) void open().catch(console.error)
    const config = await import('./config/index.js')
    if (closed) return
    watcher = await config.watchConfiguration([], () => {
      if (!closed) void controller.restart().catch(error => publish('failed', error))
    })
    if (closed) {
      await watcher.close()
      return
    }
    try {
      const revision = await config.captureProjectConfigurationRevision(root, options.config)
      await watcher.update(await config.configurationWatchInputs({ root, config: options.config, revision }))
    }
    catch (error) {
      // Runtime still reports its own inputs; an unreadable candidate must not disable watching.
      console.error(error)
    }
    if (closed) return
    await http.prepare()
  })()
  const boot = prepared.then(async () => {
    if (!closed) await controller.start()
  })
  const ready = boot.catch((error) => {
    if (!closed) publish('failed', error)
    throw error
  })
  void ready.catch(() => {
  })
  /** Manual replacement uses same serialized winddown as configuration changes. */
  async function restart() {
    if (closed) throw new Error('Histoire proxy closed')
    await prepared
    await controller.restart().catch((error) => {
      publish('failed', error)
      throw error
    })
  }
  return {
    /** Actual public address, including OS-selected or fallback port. */
    url,
    /** Initial runtime acquisition; watcher remains live after rejection. */
    ready,
    /** Latest public availability, independent of any runtime process. */
    get status() {
      return state.status
    },
    restart,
    /** Stop observation/admission synchronously before joining child shutdown. */
    close() {
      return closing ??= (async () => {
        closed = true
        publish('closed')
        const stop = controller.close()
        await Promise.allSettled([boot])
        try {
          await stop
        }
        finally {
          off()
          await watcher?.close()
          await http.close()
        }
      })()
    },
  }
}
