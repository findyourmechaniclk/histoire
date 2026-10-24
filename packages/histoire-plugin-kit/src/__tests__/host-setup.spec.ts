import { describe, expect, it, vi } from 'vitest'
import { addCommand, commandPlugin, createTestHost, deferred, ids, plugin } from './fixtures/host.js'

describe('extension host setup', () => {
  it('commits registrations atomically and notifies once per commit', async () => {
    const gate = deferred()
    const host = createTestHost([plugin('acme', async (api) => {
      addCommand(api, 'one')
      addCommand(api, 'two')
      await gate.promise
    })])
    const listener = vi.fn()
    host.subscribe(listener)
    await Promise.resolve()
    // Provisional registrations stay invisible while setup is pending.
    expect(ids(host)).toEqual([])
    expect(listener).not.toHaveBeenCalled()
    gate.resolve()
    await host.ready
    expect(ids(host)).toEqual(['acme:one', 'acme:two'])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('exposes ownership on committed contributions', async () => {
    const host = createTestHost([commandPlugin('acme', ['run'])])
    await host.ready
    expect(host.contributions('command')[0]).toMatchObject({ id: 'acme:run', localId: 'run', pluginId: 'acme', kind: 'command' })
  })

  it('rolls back a rejected setup and releases acquired resources exactly once', async () => {
    const aborted = vi.fn()
    const prefListener = vi.fn()
    const error = new Error('boom')
    let api!: Parameters<Parameters<typeof plugin>[1]>[0]
    const host = createTestHost([plugin('acme', async (pluginApi) => {
      api = pluginApi
      pluginApi.signal.addEventListener('abort', aborted)
      pluginApi.preferences.subscribe('mode', prefListener)
      addCommand(pluginApi, 'run')
      throw error
    })])
    await host.ready
    expect(ids(host)).toEqual([])
    expect(aborted).toHaveBeenCalledTimes(1)
    expect(host.diagnostics()).toEqual([{ pluginId: 'acme', phase: 'setup', error }])
    // The failed plugin can no longer register or observe its preferences.
    addCommand(api, 'late')
    api.preferences.set('mode', 'dark')
    expect(ids(host)).toEqual([])
    expect(prefListener).not.toHaveBeenCalled()
    await host.dispose()
    expect(aborted).toHaveBeenCalledTimes(1)
  })

  it('isolates a failing plugin from the others', async () => {
    const host = createTestHost([
      commandPlugin('first', ['a']),
      plugin('broken', () => {
        throw new Error('sync failure')
      }),
      commandPlugin('last', ['b']),
    ])
    await host.ready
    expect(ids(host)).toEqual(['first:a', 'last:b'])
    expect(host.diagnostics().map(entry => entry.pluginId)).toEqual(['broken'])
  })

  it('settles ready only after every setup settled', async () => {
    const slow = deferred()
    const host = createTestHost([commandPlugin('fast', ['a']), plugin('slow', () => slow.promise)])
    let settled = false
    void host.ready.then(() => settled = true)
    await new Promise(resolve => setTimeout(resolve))
    expect(settled).toBe(false)
    // Fast plugins commit without waiting for slow siblings.
    expect(ids(host)).toEqual(['fast:a'])
    slow.reject(new Error('late failure'))
    await host.ready
    expect(host.diagnostics()).toHaveLength(1)
  })

  it('rejects a duplicate qualified id without replacing the existing entry', async () => {
    const first = vi.fn()
    let duplicateError: unknown
    const host = createTestHost([plugin('acme', (api) => {
      api.commands.add({ id: 'run', label: 'First', icon: 'play', run: first })
      try {
        api.commands.add({ id: 'run', label: 'Second', icon: 'play', run: () => {} })
      }
      catch (error) {
        duplicateError = error
      }
    })])
    await host.ready
    expect(duplicateError).toBeInstanceOf(Error)
    expect(host.contributions('command').map(entry => entry.label)).toEqual(['First'])
  })

  it('rejects unknown kinds and invalid local ids at registration', async () => {
    const host = createTestHost([plugin('acme', (api) => {
      expect(() => api.contribute({ kind: 'nope', id: 'x' } as any)).toThrow(/kind/)
      expect(() => addCommand(api, 'a:b')).toThrow(/contribution id/)
    })])
    await host.ready
    expect(host.diagnostics().map(entry => entry.phase)).toEqual(['register', 'register'])
  })

  it('registers directly after setup with the same ownership', async () => {
    let api!: Parameters<Parameters<typeof plugin>[1]>[0]
    const host = createTestHost([plugin('acme', (pluginApi) => {
      api = pluginApi
    })])
    await host.ready
    const listener = vi.fn()
    host.subscribe(listener)
    const remove = addCommand(api, 'later')
    expect(ids(host)).toEqual(['acme:later'])
    expect(listener).toHaveBeenCalledTimes(1)
    remove()
    remove()
    expect(ids(host)).toEqual([])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('records invalid definitions and duplicate plugin ids without installing them', async () => {
    const host = createTestHost([
      commandPlugin('acme', ['a']),
      { id: 'Bad', apiVersion: 1, setup: () => {} } as any,
      { definition: commandPlugin('acme', ['b']) },
    ])
    await host.ready
    expect(ids(host)).toEqual(['acme:a'])
    expect(host.diagnostics().map(({ pluginId, phase }) => ({ pluginId, phase }))).toEqual([
      { pluginId: 'Bad', phase: 'load' },
      { pluginId: 'acme', phase: 'load' },
    ])
  })

  it('passes per-plugin options to setup', async () => {
    const seen = vi.fn()
    const host = createTestHost([{ definition: plugin('acme', api => seen(api.id, api.options)), options: { level: 'AA' } }])
    await host.ready
    expect(seen).toHaveBeenCalledWith('acme', { level: 'AA' })
  })
})
