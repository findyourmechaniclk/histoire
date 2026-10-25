// @vitest-environment jsdom
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNetworkMock } from '../../client/network.js'

let nativeFetch: typeof fetch
let networkFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  nativeFetch = window.fetch
  networkFetch = vi.fn(async () => new Response('network'))
  window.fetch = networkFetch as any
})

afterEach(() => {
  window.fetch = nativeFetch
})

describe('mockNetwork', () => {
  it('answers fetch with variant handlers first, then defaults, then the network', async () => {
    const log = vi.fn()
    const { mockNetwork, mockNetworkDefaults } = createNetworkMock(log)
    mockNetworkDefaults(
      http.get('/api/session', () => HttpResponse.json({ user: 1 })),
      http.get('/api/items', () => HttpResponse.json(['default'])),
    )
    mockNetwork(http.get('/api/items', () => HttpResponse.json(['variant'])))

    await expect(fetch('/api/session').then(r => r.json())).resolves.toEqual({ user: 1 })
    await expect(fetch('/api/items').then(r => r.json())).resolves.toEqual(['variant'])
    await expect(fetch('/api/other', { method: 'POST' }).then(r => r.text())).resolves.toBe('network')
    // Unmatched requests reach the previous fetch with their original arguments.
    expect(networkFetch).toHaveBeenCalledWith('/api/other', { method: 'POST' })
    expect(log).toHaveBeenCalledWith('fetch', { method: 'GET', url: 'http://localhost:3000/api/items', status: 200 })

    // Variant handlers are replaced, not added.
    mockNetwork()
    await expect(fetch('/api/items').then(r => r.json())).resolves.toEqual(['default'])
  })

  it('wraps fetch once, and again when fetch was replaced', async () => {
    const first = createNetworkMock(() => {})
    first.mockNetwork(http.get('/a', () => HttpResponse.text('a')))
    const wrapped = window.fetch
    first.mockNetworkDefaults()
    expect(window.fetch).toBe(wrapped)

    window.fetch = networkFetch as any
    first.mockNetwork(http.get('/a', () => HttpResponse.text('again')))
    await expect(fetch('/a').then(r => r.text())).resolves.toBe('again')
  })
})
