import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { embedSourceModule } from '../virtual/embed/virtual.js'

/**
 * The dev workbench reads its catalog descriptor once at startup. That request
 * is held open until the server is ready, so it must survive dropped
 * connections (e.g. Chromium `net::ERR_NETWORK_CHANGED`) instead of leaving the
 * workbench without any story.
 */

let dir: string | undefined

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = undefined
})

/** Evaluates the generated module like Vite would serve it, without HMR. */
async function importSourceModule(command: 'serve' | 'build') {
  dir = await mkdtemp(join(tmpdir(), 'histoire-local-source-'))
  const file = join(dir, `source-${command}.mjs`)
  await writeFile(file, embedSourceModule('local', command).replaceAll('import.meta.env.BASE_URL', '"/"').replaceAll('import.meta.hot', 'undefined'))
  return import(pathToFileURL(file).href) as Promise<{ loadDescriptor: () => Promise<unknown> }>
}

describe('local source module', () => {
  it('retries the dev descriptor after dropped connections and while the server starts', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('location', { origin: 'http://localhost:6006' })
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ revision: 'r1' }))
    vi.stubGlobal('fetch', fetch)
    const { loadDescriptor } = await importSourceModule('serve')

    const loading = loadDescriptor()
    await vi.runAllTimersAsync()

    await expect(loading).resolves.toEqual({ revision: 'r1' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('fails right away on other errors and in static books', async () => {
    vi.stubGlobal('location', { origin: 'http://localhost:6006' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    const { loadDescriptor } = await importSourceModule('serve')
    await expect(loadDescriptor()).rejects.toThrow('Local source catalog is unavailable')

    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetch)
    const built = await importSourceModule('build')
    await expect(built.loadDescriptor()).rejects.toThrow('Failed to fetch')
    expect(fetch).toHaveBeenCalledOnce()
  })
})
