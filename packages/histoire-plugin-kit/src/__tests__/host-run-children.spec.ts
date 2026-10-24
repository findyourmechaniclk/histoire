import { describe, expect, it, vi } from 'vitest'
import { createTestHost, plugin } from './fixtures/host.js'

describe('frame-menu child actions', () => {
  it('runs a child addressed as itemId:childId and attributes its failure', async () => {
    const copy = vi.fn()
    const error = new Error('child failed')
    const host = createTestHost([plugin('acme', (api) => {
      api.menus.addFrameAction({ id: 'export', label: 'Export', icon: 'export', run: () => {}, children: [
        { id: 'json', label: 'JSON', icon: 'code', run: copy },
        { id: 'broken', label: 'Broken', icon: 'code', run: () => {
          throw error
        } },
      ] })
    })])
    await host.ready
    const context = { captured: true }

    await host.run('acme:export:json', context)
    await expect(host.run('acme:export:broken', context)).rejects.toBe(error)

    expect(copy).toHaveBeenCalledWith(context, { signal: expect.any(AbortSignal) })
    expect(host.diagnostics()).toEqual([{ pluginId: 'acme', contributionId: 'acme:export:broken', phase: 'run', error }])
    await expect(host.run('acme:export:missing', context)).rejects.toThrow(/acme:export:missing/)
  })

  it('stops addressing children once their item is removed', async () => {
    let remove!: () => void
    const host = createTestHost([plugin('acme', (api) => {
      remove = api.menus.addFrameAction({ id: 'export', label: 'Export', icon: 'export', run: () => {}, children: [{ id: 'json', label: 'JSON', icon: 'code', run: () => {} }] })
    })])
    await host.ready
    remove()
    await expect(host.run('acme:export:json', {})).rejects.toThrow(/acme:export:json/)
  })
})
