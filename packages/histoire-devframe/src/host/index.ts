import type { DevframeInstance, InitDevframeOptions } from 'devframe/initiate'
import type { Server } from 'node:http'
import type { DevframeBridgeOptions } from '../node/devframe.js'
import { initDevframe } from 'devframe/initiate'
import { createDevframeBridge } from '../node/devframe.js'

/** Options for an explicitly authenticated bridge on a caller-owned server. */
export interface DevframeHostOptions {
  /** Existing HTTP or HTTPS server; the host retains ownership. */
  server: Server
  /** Dedicated path with a leading and trailing slash. */
  base: string
  /** Public origin of the host. */
  origin: string
  /** Custom transport authentication must bind verified credentials to a principal. */
  auth: Exclude<InitDevframeOptions['auth'], boolean | undefined>
  /** Host policy and verified peer identity for the finite broker. */
  bridge: DevframeBridgeOptions
  /** Additional origins allowed to open the WebSocket. */
  allowedOrigins?: readonly string[]
  /** Caller cleanup for transport identity state. */
  onPeerDisconnect?: InitDevframeOptions['onPeerDisconnect']
}

/** Mounted host resources owned by the adapter. */
export interface DevframeHost {
  /** Authenticated finite broker and its lifecycle. */
  bridge: ReturnType<typeof createDevframeBridge>
  /** Normalized middleware base. */
  base: string
  /** Connect middleware for the caller's server. */
  nodeMiddleware: DevframeInstance['nodeMiddleware']
  /** Retire attachments and release owned registrations. */
  dispose: () => Promise<void>
}

const mounts = new WeakMap<Server, Set<string>>()

/** Mount only the bridge; caller installs middleware and owns its server and credentials. */
export async function mountDevframeHost(options: DevframeHostOptions): Promise<DevframeHost> {
  if (!/^\/(?:[\w-]+\/)+$/.test(options.base)) throw new Error('Invalid host mount base')
  if (!options.auth || typeof options.auth !== 'object' || typeof options.auth.authorize !== 'function' || typeof options.auth.onConnect !== 'function' || !Array.isArray(options.auth.rpcFunctions)) throw new Error('Transport authentication required')
  let origin: URL
  try {
    origin = new URL(options.origin)
  }
  catch { throw new Error('Invalid host origin') }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== options.origin) throw new Error('Invalid host origin')
  const bases = mounts.get(options.server) ?? new Set<string>()
  if ([...bases].some(base => base.startsWith(options.base) || options.base.startsWith(base))) throw new Error('Host mount already exists')
  const bridge = createDevframeBridge(options.bridge)
  bases.add(options.base)
  mounts.set(options.server, bases)
  let instance: ReturnType<typeof initDevframe> | undefined
  let disposed = false
  let closing: Promise<void> | undefined
  /** Remove only this mount's registrations and transport. */
  function dispose() {
    if (closing) return closing
    const completion = Promise.withResolvers<void>()
    closing = completion.promise
    disposed = true
    void (async () => {
      try {
        await bridge.dispose()
      }
      finally {
        try {
          await instance?.close()
        }
        finally {
          bases.delete(options.base)
          if (!bases.size && mounts.get(options.server) === bases) mounts.delete(options.server)
        }
      }
    })().then(completion.resolve, completion.reject)
    return closing
  }
  try {
    instance = initDevframe(bridge.definition, {
      base: options.base,
      server: options.server,
      origin: options.origin,
      auth: options.auth,
      allowedOrigins: options.allowedOrigins,
      distDir: false,
      sse: false,
      mcp: false,
      register: false,
      onPeerDisconnect(connection, meta) {
        bridge.onPeerDisconnect(meta)
        options.onPeerDisconnect?.(connection, meta)
      },
    })
    await instance.ready
    const initialized = instance
    return {
      bridge,
      base: initialized.base,
      /** Mount unprefixed; after disposal, pass all requests to the host. */
      nodeMiddleware: ((request, response, next) => {
        if (disposed) return next?.()
        initialized.nodeMiddleware(request, response, next)
      }) as typeof initialized.nodeMiddleware,
      dispose,
    }
  }
  catch (error) {
    await dispose()
    throw error
  }
}
