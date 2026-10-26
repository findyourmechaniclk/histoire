import { resolveStoryRouteId, STORY_ROUTE_PATH } from '@histoire/protocol'
import { createMemoryHistory, createRouter } from '@histoire/vendors/vue-router'
import { describe, expect, it } from 'vitest'
import { createPreviewUrls } from '../../mcp/project/preview-urls.js'

describe('exact Histoire preview URLs', () => {
  it.each(['hash', 'history'] as const)('preserves base and hostile identity in %s router', (routerMode) => {
    const router = createRouter({ history: createMemoryHistory('/book/'), routes: [{ path: STORY_ROUTE_PATH, name: 'story', component: {} }] })
    for (const storyId of ['normal', '雪/a? #%', '.', '..', '%2E']) {
      const variantId = 'shared/雪? #%'
      const urls = createPreviewUrls({ origin: 'http://localhost:7482/book/', base: '/book/', routerMode, storyId, variantId })
      const browserUrl = new URL(urls.storyUrl)
      const location = routerMode === 'hash' ? browserUrl.hash.slice(1) : `${browserUrl.pathname.slice('/book'.length)}${browserUrl.search}`
      const route = router.resolve(location)
      expect(route.name).toBe('story')
      expect(resolveStoryRouteId(route.params, route.query)).toBe(storyId)
      expect(route.query.variantId).toBe(variantId)
      expect(browserUrl.origin).toBe('http://localhost:7482')
      const sandbox = new URL(urls.sandboxUrl)
      expect(sandbox.pathname).toBe('/book/__sandbox.html')
      expect(sandbox.searchParams.get('storyId')).toBe(storyId)
      expect(sandbox.searchParams.get('variantId')).toBe(variantId)
    }
  })

  it('resolves query identity only for pathless dot IDs and gives normal params priority', () => {
    expect(resolveStoryRouteId({}, { storyId: '..' })).toBe('..')
    expect(resolveStoryRouteId({ storyId: 'selected' }, { storyId: '..' })).toBe('selected')
    expect(resolveStoryRouteId({}, { storyId: 'foreign' })).toBeUndefined()
    expect(resolveStoryRouteId({}, { storyId: ['..', '.'] })).toBeUndefined()
  })

  it('rejects credential-bearing and non-HTTP origins', () => {
    for (const origin of ['https://token@example.com', 'file:///private/project']) {
      expect(() => createPreviewUrls({ origin, base: '/', routerMode: 'history', storyId: 'story', variantId: 'variant' })).toThrow(/origin/)
    }
  })

  it('rejects bases that could select another origin or inject URL fields', () => {
    for (const base of ['//foreign.example/', 'https://foreign.example/', '/book?foreign/', '/book\\foreign/']) {
      expect(() => createPreviewUrls({ origin: 'https://book.example', base, routerMode: 'history', storyId: 'story', variantId: 'variant' })).toThrow('same-origin absolute path')
    }
  })
})
