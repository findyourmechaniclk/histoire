import { isModuleLoadFailure } from '@histoire/shared'
import { describe, expect, it, vi } from 'vitest'
import { ENTRY_RELOAD_SCRIPT, renderModuleEntry, UNHANDLED_MODULE_FAILURE_SCRIPT } from '../vite/entry-reload.js'

/**
 * Dev documents (workbench, story frames) whose module graph fails to load,
 * e.g. on Chromium `net::ERR_NETWORK_CHANGED`, reload instead of staying blank.
 */

/** Runs the inline script against a fake window; returns its failure handler. */
function install(storage = new Map<string, string>(), fetch = vi.fn(async () => new Response())) {
  const win = {
    location: { pathname: '/__sandbox.html', search: '?documentId=a', href: 'http://localhost/__sandbox.html?documentId=a', reload: vi.fn() },
    sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    setTimeout: (callback: () => void) => callback(),
    fetch,
  } as any
  // eslint-disable-next-line no-new-func
  new Function('window', ENTRY_RELOAD_SCRIPT)(win)
  return { win, storage }
}

describe('entry reload', () => {
  it('reloads after a failed entry, at most 3 times a minute per document', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { win, storage } = install()
    expect(Array.from({ length: 5 }, () => win.__histoireEntryFailed())).toEqual([true, true, true, false, false])
    await vi.waitFor(() => expect(win.location.reload).toHaveBeenCalledTimes(3))

    vi.advanceTimersByTime(61_000)
    install(storage).win.__histoireEntryFailed()
    expect(win.location.reload).toHaveBeenCalledTimes(3)
    expect([...storage.values()].map(value => JSON.parse(value).length)).toEqual([1])
    vi.useRealTimers()
  })

  it('waits until the server answers before reloading', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(new Response())
    const { win } = install(undefined, fetch)
    win.__histoireEntryFailed()
    await vi.waitFor(() => expect(win.location.reload).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch).toHaveBeenCalledWith(win.location.href, { method: 'HEAD', cache: 'no-store' })
  })

  it('never reloads without session storage', () => {
    const { win } = install()
    win.sessionStorage.setItem = () => {
      throw new Error('blocked')
    }
    win.__histoireEntryFailed()
    expect(win.location.reload).not.toHaveBeenCalled()
  })

  it('recognizes failed dynamic module fetches, not errors thrown by modules', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: http://localhost/a.vue',
      'error loading dynamically imported module: http://localhost/a.vue',
      'Importing a module script failed.',
    ]) expect(isModuleLoadFailure(new TypeError(message))).toBe(true)
    expect(isModuleLoadFailure(new TypeError('Cannot read properties of undefined'))).toBe(false)
  })

  it('reloads on unhandled failed module fetches only', () => {
    const listeners: ((event: { reason: unknown }) => void)[] = []
    const win = { __histoireEntryFailed: vi.fn(), addEventListener: (_: string, listener: any) => listeners.push(listener) }
    // eslint-disable-next-line no-new-func
    new Function('window', UNHANDLED_MODULE_FAILURE_SCRIPT)(win)
    listeners[0]({ reason: new TypeError('Failed to fetch dynamically imported module: http://localhost/Panel.js') })
    listeners[0]({ reason: new Error('Boom') })
    listeners[0]({ reason: undefined })
    expect(win.__histoireEntryFailed).toHaveBeenCalledOnce()
  })

  it('wires the module entry to the handler', () => {
    expect(renderModuleEntry('/entry.js')).toBe('<script type="module" src="/entry.js" onerror="__histoireEntryFailed()"></script>')
  })
})
