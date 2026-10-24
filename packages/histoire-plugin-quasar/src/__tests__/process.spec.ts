/* eslint-disable no-console -- asserts Quasar CLI console output buffering */
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runInQuasarScope } from '../config/process.js'

const root = resolve('/quasar-project')

describe('runInQuasarScope', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the project root as cwd to Quasar code only, without changing the process cwd', async () => {
    const realCwd = process.cwd()
    const cwdFunction = process.cwd
    const [result, outside] = await Promise.all([
      runInQuasarScope(root, async () => {
        await new Promise(resolve => setTimeout(resolve))
        return [process.cwd(), resolve('src')]
      }),
      // Other in-process work during the load keeps the real cwd.
      Promise.resolve().then(() => process.cwd()),
    ])
    expect(result).toEqual([root, resolve(root, 'src')])
    expect(outside).toBe(realCwd)
    expect(process.cwd).toBe(cwdFunction)
  })

  it('keeps Quasar progress output quiet on success but shows warnings', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await runInQuasarScope(root, async () => {
      console.log('Compiling quasar.config...')
      console.warn('deprecated option')
    })
    expect(log).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('deprecated option')
  })

  it('turns Quasar fatal exits into errors and prints the buffered reason first', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = process.exit
    await expect(runInQuasarScope(root, async () => {
      console.log('App Extension is missing')
      await Promise.resolve()
      process.exit(1)
    })).rejects.toThrow('exit code 1')
    expect(log).toHaveBeenCalledWith('App Extension is missing')
    expect(process.exit).toBe(exit)
  })

  it('isolates overlapping loads and restores globals once both finished', async () => {
    const cwdFunction = process.cwd
    const otherRoot = resolve('/other-project')
    const [a, b] = await Promise.all([
      runInQuasarScope(root, async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return process.cwd()
      }),
      runInQuasarScope(otherRoot, async () => process.cwd()),
    ])
    expect([a, b]).toEqual([root, otherRoot])
    expect(process.cwd).toBe(cwdFunction)
  })

  it('treats timers created by a finished load as regular code during a later load', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const realCwd = process.cwd()
    let leaked: Promise<string> | undefined
    await runInQuasarScope(root, async () => {
      // e.g. a watcher started by a Vite plugin factory or the user config.
      leaked = new Promise(resolve => setTimeout(() => {
        console.log('watcher tick')
        resolve(process.cwd())
      }, 20))
    })
    await runInQuasarScope(resolve('/other-project'), async () => {
      expect(await leaked).toBe(realCwd)
    })
    expect(log).toHaveBeenCalledWith('watcher tick')
  })

  it('shows Quasar logger warnings and errors printed with console.log', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runInQuasarScope(root, async () => {
      // Quasar's `warning()` and App Extension `api.logger.warning()` format.
      console.log(' \u001B[33mApp •\u001B[39m \u001B[43m\u001B[30m WARNING \u001B[39m\u001B[49m Something is off')
      console.log(' App • INFO Compiling')
    })
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('does not replay its own exit error logged by Quasar before exiting again', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(runInQuasarScope(root, async () => {
      try {
        process.exit(1)
      }
      catch (exitError) {
        // Quasar logs caught errors, then calls `fatal()` again.
        console.error(exitError)
        console.error('App Extension failed')
      }
      process.exit(1)
    })).rejects.toThrow('exit code 1')
    expect(error.mock.calls).toEqual([['App Extension failed']])
  })

  it('restores the real cwd when a library cached it during the load', async () => {
    const realCwd = process.cwd()
    const { cwd, chdir } = process
    try {
      await runInQuasarScope(root, async () => {
        // graceful-fs, loaded for the first time inside the load, wraps
        // `process.cwd` with a cache it only clears on `process.chdir`.
        const origCwd = process.cwd
        let cached: string | null = null
        process.cwd = () => cached ??= origCwd.call(process)
        process.chdir = (dir: string) => {
          cached = null
          chdir.call(process, dir)
        }
        expect(process.cwd()).toBe(root)
      })
      expect(process.cwd()).toBe(realCwd)
    }
    finally {
      process.cwd = cwd
      process.chdir = chdir
    }
  })
})
