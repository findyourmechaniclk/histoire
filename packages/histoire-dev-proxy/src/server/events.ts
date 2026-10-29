import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PublicState } from '../protocol.js'

/** SSE channel independent of Vite and runtime process lifetime. */
export function createStatusChannel(read: () => PublicState) {
  const clients = new Set<ServerResponse>()
  /** Drop slow/disconnected consumers instead of buffering unbounded state. */
  function write(response: ServerResponse, data: string) {
    if (!response.write(data)) {
      clients.delete(response)
      response.destroy()
    }
  }
  const heartbeat = setInterval(() => {
    for (const response of clients) write(response, ': heartbeat\n\n')
  }, 15_000)
  heartbeat.unref()
  return {
    /** Immediately publish latest state on reconnect. */
    connect(_request: IncomingMessage, response: ServerResponse) {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'connection': 'keep-alive', 'x-accel-buffering': 'no' })
      clients.add(response)
      response.once('close', () => clients.delete(response))
      write(response, `data: ${JSON.stringify(read())}\n\n`)
    },
    /** State snapshots supersede previous observations; no event replay buffer needed. */
    publish() {
      for (const response of clients) write(response, `data: ${JSON.stringify(read())}\n\n`)
    },
    /** End streams before closing listener. */
    close() {
      clearInterval(heartbeat)
      for (const response of clients) response.end()
      clients.clear()
    },
  }
}
