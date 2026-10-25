import type { Plugin, ViteDevServer } from 'vite'

/**
 * Makes the collection server's watcher ignore every path, so it never crawls
 * the project. `server.watch: null` would also skip the crawl, but Vite then
 * disables its resolver cache, which slows every collection transform.
 */
export function collectionWatchPlugin(): Plugin {
  return {
    name: 'histoire:collection-watch',
    enforce: 'post',
    config: () => ({ server: { watch: { ignored: [() => true] } } }),
  }
}

/**
 * Replays the client server's file events on the collection server's watcher,
 * in chokidar's order (named event, then `all`). Both servers watch the same
 * project with the same options, so Vite and plugins on the collection server
 * see the events their own crawl would have produced.
 * @param client Server whose watcher crawls the project.
 * @param collection Server using {@link collectionWatchPlugin}.
 */
export function forwardWatcherEvents(client: ViteDevServer, collection: ViteDevServer) {
  const forward = (event: string, path: string) => {
    collection.watcher.emit(event, path)
    collection.watcher.emit('all', event, path)
  }
  client.watcher.on('all', forward)
  return () => {
    client.watcher.off('all', forward)
  }
}
