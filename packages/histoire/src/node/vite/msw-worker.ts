import type { Connect, ViteDevServer } from 'vite'
import fs from 'fs-extra'
import { join } from 'pathe'
import { resolveMswWorkerPath } from '../util/resolve-msw-worker.js'
import { applyDevResponseHeaders } from './dev-html.js'

const WORKER_FILE = 'mockServiceWorker.js'

/**
 * Serves the project's MSW service worker in dev, like `histoire build` copies
 * it next to the build. Without it, `setupWorker().start()` in a story gets the
 * app HTML from the history fallback.
 *
 * Only the project's own msw is used (dev mocks modules without MSW), and a
 * copy in its `publicDir` (written by `msw init`) is left to Vite.
 * @param server The Vite dev server the middleware is registered on.
 * @param root The project root to resolve `msw` from.
 */
export function createMswWorkerMiddleware(server: ViteDevServer, root: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const pathname = req.url?.split('?')[0]
    if (pathname !== `${server.config.base}${WORKER_FILE}`) return next()

    const publicDir = server.config.publicDir
    const workerPath = publicDir && fs.existsSync(join(publicDir, WORKER_FILE))
      ? null
      : resolveMswWorkerPath(root, { fallback: false })
    if (!workerPath) return next()

    applyDevResponseHeaders(server, res)
    res.setHeader('Content-Type', 'text/javascript')
    res.end(await fs.readFile(workerPath))
  }
}
