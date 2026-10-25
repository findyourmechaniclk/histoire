import type { ViteDevServer } from 'vite'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { createServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectionWatchPlugin, forwardWatcherEvents } from '../server/collection-watcher.js'

/**
 * Collection and client dev servers watch the same project. Only the client
 * server crawls it (a crawl cost ~0.5 s of the main thread at startup and
 * doubled inotify watches); the collection server receives its events.
 */

let root: string
const servers: ViteDevServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  await rm(root, { recursive: true, force: true })
})

async function start(plugins: any[] = []) {
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false }, plugins })
  servers.push(server)
  return server
}

describe('collection watcher', () => {
  it('watches nothing itself and receives the client watcher events', async () => {
    root = await mkdtemp(join(tmpdir(), 'histoire-collection-watch-'))
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'src/a.js'), 'export default 1')
    const client = await start()
    const collection = await start([collectionWatchPlugin()])
    forwardWatcherEvents(client, collection)

    await vi.waitFor(() => expect(Object.keys(client.watcher.getWatched()).some(dir => dir.endsWith('/src'))).toBe(true))
    expect(Object.values(collection.watcher.getWatched()).flat()).toEqual([])

    const changed = vi.fn()
    const all = vi.fn()
    collection.watcher.on('change', changed)
    collection.watcher.on('all', all)
    client.watcher.emit('all', 'change', join(root, 'src/a.js'))
    client.watcher.emit('change', join(root, 'src/a.js'))

    expect(changed).toHaveBeenCalledExactlyOnceWith(join(root, 'src/a.js'))
    expect(all).toHaveBeenCalledExactlyOnceWith('change', join(root, 'src/a.js'))
  })
})
