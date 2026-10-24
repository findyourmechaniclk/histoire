import type { PluginPreferences } from '../index.js'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryStorage, createObservableStorage, createTestHost, plugin } from './fixtures/host.js'

/**
 * Installs one plugin over `storage` and returns its preferences.
 * @param storage Injected storage.
 */
async function preferencesOf(storage = createMemoryStorage()): Promise<PluginPreferences> {
  let preferences!: PluginPreferences
  const host = createTestHost([plugin('acme', api => void (preferences = api.preferences))], { storage })
  await host.ready
  return preferences
}

describe('plugin preferences', () => {
  it('round-trips JSON values and falls back on absent or corrupt entries', async () => {
    const storage = createMemoryStorage()
    storage.setItem('plugin:acme:broken', '{nope')
    const preferences = await preferencesOf(storage)
    expect(preferences.get('broken', 'fallback')).toBe('fallback')
    expect(preferences.get('missing', 3)).toBe(3)
    preferences.set('layout', { columns: 2, labels: ['a'] })
    expect(preferences.get('layout', null)).toEqual({ columns: 2, labels: ['a'] })
  })

  it('notifies subscribers of the changed key only', async () => {
    const preferences = await preferencesOf()
    const mode = vi.fn()
    const other = vi.fn()
    const stop = preferences.subscribe('mode', mode)
    preferences.subscribe('other', other)
    preferences.set('mode', 'dark')
    stop()
    preferences.set('mode', 'light')
    expect(mode).toHaveBeenCalledTimes(1)
    expect(mode).toHaveBeenCalledWith('dark')
    expect(other).not.toHaveBeenCalled()
  })

  it('notifies host subscribers after a write, so toggles and badges re-read plugin state', async () => {
    let preferences!: PluginPreferences
    const host = createTestHost([plugin('acme', api => void (preferences = api.preferences))])
    await host.ready
    const listener = vi.fn()
    host.subscribe(listener)
    preferences.set('badges', false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('delivers values written outside the host, such as by another tab, and stops observing storage on dispose', async () => {
    const storage = createObservableStorage()
    let preferences!: PluginPreferences
    const host = createTestHost([plugin('acme', api => void (preferences = api.preferences))], { storage, storageNamespace: 'book' })
    await host.ready
    const mode = vi.fn()
    preferences.subscribe('mode', mode)
    const changed = vi.fn()
    host.subscribe(changed)

    storage.external('book:plugin:acme:mode', '"dark"')
    expect(mode).toHaveBeenCalledExactlyOnceWith('dark')
    expect(preferences.get('mode', 'light')).toBe('dark')
    expect(changed).toHaveBeenCalledTimes(1)

    // Other projects' preferences and foreign keys sharing the storage are not ours.
    storage.external('other-book:plugin:acme:mode', '"light"')
    storage.external('unrelated', 'x')
    expect(mode).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledTimes(1)

    await host.dispose()
    expect(storage.listeners.size).toBe(0)
  })

  it('lets a value written elsewhere replace one this host kept in memory after a failed write', async () => {
    const storage = createObservableStorage()
    const setItem = storage.setItem
    storage.setItem = () => {
      throw new Error('quota')
    }
    const preferences = await preferencesOf(storage)
    preferences.set('mode', 'dark')
    storage.setItem = setItem
    storage.external('plugin:acme:mode', '"light"')
    expect(preferences.get('mode', 'unset')).toBe('light')
  })

  it('keeps values readable when storage writes fail', async () => {
    const storage = createMemoryStorage()
    storage.setItem = () => {
      throw new Error('quota')
    }
    const preferences = await preferencesOf(storage)
    preferences.set('mode', 'dark')
    expect(preferences.get('mode', 'light')).toBe('dark')
  })
})
