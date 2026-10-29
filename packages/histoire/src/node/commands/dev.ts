import type { DevMcpCliOptions } from '../mcp/transport/http-options.js'
import { randomUUID } from 'node:crypto'
import { startDevProxy } from '@histoire/dev-proxy'
import { captureMcpToken } from '../mcp/transport/http-auth.js'
import { resolveDevMcpOptions } from '../mcp/transport/http-options.js'

/** CLI-only inputs; importing this module must never load project/runtime graphs. */
export interface DevOptions extends DevMcpCliOptions {
  /** Public proxy port; defaults to 6006. */
  port?: number | string
  /** Public binding independent of private Vite listener. */
  host?: string | boolean
  /** Explicit project directory. */
  root?: string
  /** Explicit configuration path. */
  config?: string
  /** Open public URL before runtime becomes ready. */
  open?: boolean
}

/** CLI parent owns public proxy and its process signal registrations. */
export async function devCommand(options: DevOptions) {
  resolveDevMcpOptions(undefined, options)
  if (typeof options.port === 'string' && !/^\d+$/.test(options.port)) throw new Error('Port must be an integer from 0 to 65535')
  const token = captureMcpToken()
  let publicUrl = ''
  const proxy = await startDevProxy({ ...options, port: options.port === undefined ? undefined : Number(options.port), token, runtime: new URL('./dev-child.js', import.meta.url), runtimeOptions: { ...options, projectId: randomUUID() }, onListening(url) {
    publicUrl = url
    process.stdout.write(`  Histoire: ${url}\n`)
  }, onStatus(state) {
    if (state.status === 'restarting') process.stdout.write('Config changed, restarting...\n')
    if (state.status === 'ready') process.stdout.write(`  Local: ${new URL(state.base, publicUrl).href}\n`)
  } })
  /** Remove only command-owned signal listeners before winddown. */
  function close() {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    return proxy.close()
  }
  /** Retain teardown failures as nonzero process status. */
  function onSignal() {
    void close().catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  // Failed config keeps parent/watcher available for correction and automatic retry.
  void proxy.ready.catch(error => console.error(String(error)))
  return { ...proxy, get status() {
    return proxy.status
  }, close }
}
