import type { ParentMessage } from '@histoire/dev-proxy/protocol'
import type { createDevSession } from '../runtime/dev-session.js'

// Credentials arrive over private IPC, never through project-visible environment.
delete process.env.HISTOIRE_MCP_TOKEN
process.env.NODE_ENV = 'development'
process.env.HISTOIRE = 'true'
let session: ReturnType<typeof createDevSession> | undefined
let startup: Promise<void> | undefined
let closing: Promise<void> | undefined
let stopped = false

/** Send observations only while owning parent remains connected. */
function send(message: object) {
  if (process.connected && !stopped) process.send!(message, undefined, undefined, error => error && void close())
}

/** Drain runtime before releasing IPC; parent bounds full winddown. */
function close() {
  stopped = true
  return closing ??= (async () => {
    try {
      await session?.close()
      await startup?.catch(() => {
      })
      await session?.close()
    }
    catch (error) {
      console.error(error)
      process.exitCode = 1
    }
    finally {
      if (process.connected) process.disconnect()
    }
  })()
}

/** Evaluate project only after proxy has bound and supplied external origin. */
async function start(message: Extract<ParentMessage, { type: 'start' }>) {
  const [{ createDevSession }, { createSingleRunProjectRuntimeController }, { configurationWatchInputs, encodeWatchInputs }, { getConfigDependencies }] = await Promise.all([
    import('../runtime/dev-session.js'),
    import('../runtime/controller.js'),
    import('@histoire/dev-proxy/config'),
    import('../config/dependencies.js'),
  ])
  if (stopped) return
  session = createDevSession({
    ...message.options,
    root: process.cwd(),
    port: 0,
    host: '127.0.0.1',
    devProxy: { origin: message.publicOrigin, generation: message.generation },
    onConfigurationInputs(files) {
      send({ type: 'watch', generation: message.generation, inputs: encodeWatchInputs(files) })
    },
    async onConfiguration(context, revision) {
      const inputs = await configurationWatchInputs({ root: context.root, config: typeof message.options.config === 'string' ? message.options.config : undefined, revision, dependencies: getConfigDependencies(context.config) })
      send({ type: 'watch', generation: message.generation, inputs, complete: true })
    },
    onError: error => console.error(error),
  }, message.token, createSingleRunProjectRuntimeController)
  const runtime = await session.controller.start()
  if (stopped) return
  const address = runtime.server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Histoire runtime listener unavailable')
  send({ type: 'ready', generation: message.generation, target: `http://127.0.0.1:${address.port}`, base: runtime.server.config.base, open: runtime.server.config.__histoireProxyOpen })
  if (session.mcp?.url) process.stdout.write(`  MCP: ${session.mcp.url}${message.token === undefined ? '' : ' (bearer token required)'}\n`)
}

process.on('message', (raw: ParentMessage) => {
  if (raw?.type === 'shutdown') {
    void close()
    return
  }
  if (raw?.type !== 'start' || startup || stopped) return
  startup = start(raw).catch((error) => {
    console.error(error)
    send({ type: 'failed', generation: raw.generation, error: String(error instanceof Error ? error.message : error).slice(0, 4096) })
  })
})
process.once('disconnect', () => {
  void close()
})
process.on('SIGINT', () => {
  void close()
})
process.on('SIGTERM', () => {
  void close()
})
