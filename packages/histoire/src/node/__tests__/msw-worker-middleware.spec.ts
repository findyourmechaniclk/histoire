import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMswWorkerMiddleware } from '../vite/msw-worker.js'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** Project root, optionally with its own `msw` install and a public copy of the worker. */
function createProject(options: { msw?: boolean, publicWorker?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'histoire-msw-dev-'))
  tempRoots.push(root)
  if (options.msw) {
    const mswDir = join(root, 'node_modules/msw')
    mkdirSync(join(mswDir, 'lib'), { recursive: true })
    writeFileSync(join(mswDir, 'package.json'), JSON.stringify({ name: 'msw', version: '0.0.0-project' }))
    writeFileSync(join(mswDir, 'lib/mockServiceWorker.js'), '// project worker')
  }
  mkdirSync(join(root, 'public'))
  if (options.publicWorker) writeFileSync(join(root, 'public/mockServiceWorker.js'), '// public worker')
  return root
}

/** Runs the middleware for one request and records the response. */
async function request(root: string, url: string, base = '/') {
  const server = { config: { base, publicDir: join(root, 'public') } } as any
  const response = { headers: {} as Record<string, string>, body: undefined as string | undefined }
  const res = {
    setHeader: (name: string, value: string) => { response.headers[name.toLowerCase()] = value },
    end: (body: Uint8Array) => { response.body = new TextDecoder().decode(body) },
  } as any
  const next = vi.fn()
  await createMswWorkerMiddleware(server, root)({ url } as any, res, next)
  return { ...response, next }
}

describe('dev msw worker', () => {
  it('serves the project msw worker below the base', async () => {
    const root = createProject({ msw: true })
    const response = await request(root, '/book/mockServiceWorker.js?v=1', '/book/')
    expect(response.next).not.toHaveBeenCalled()
    expect(response.body).toBe('// project worker')
    expect(response.headers['content-type']).toContain('javascript')
  })

  it('leaves the request to Vite when the project has no msw or its own public copy', async () => {
    expect((await request(createProject(), '/mockServiceWorker.js')).next).toHaveBeenCalled()
    expect((await request(createProject({ msw: true, publicWorker: true }), '/mockServiceWorker.js')).next).toHaveBeenCalled()
    expect((await request(createProject({ msw: true }), '/other.js')).next).toHaveBeenCalled()
  })
})
