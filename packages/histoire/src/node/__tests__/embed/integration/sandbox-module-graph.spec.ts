import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'

/**
 * Upper bound of Histoire-owned module requests one dev sandbox document may
 * make. Bundled runtimes keep it near 45 today (the preserved `@histoire/app`
 * modules and vendor bundles are most of it); unbundled package output was
 * about 180, so going over the budget means a runtime fell back to per-file
 * modules.
 */
const HISTOIRE_MODULE_BUDGET = 60

/** Matches the Histoire package owning a served file, workspace or installed. */
const HISTOIRE_PACKAGE_RE = /\/(?:packages\/histoire(?:-([\w-]+))?|node_modules\/(?:@histoire\/([\w-]+)|histoire))\//

/**
 * Groups the script module URLs of Histoire packages by package name
 * (`histoire` for the core package, `shared` for `@histoire/shared`, ...).
 * @param urls Resource URLs loaded by one document.
 */
function groupHistoireModuleUrls(urls: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const url of urls) {
    const { pathname } = new URL(url)
    const match = decodeURIComponent(pathname).match(HISTOIRE_PACKAGE_RE)
    if (!match || !/\.(?:m?js|ts|vue)$/.test(pathname)) continue
    const name = match[1] ?? match[2] ?? 'histoire'
    groups.set(name, [...groups.get(name) ?? [], url])
  }
  return groups
}

describe('dev sandbox module graph', () => {
  it('loads each stateful Histoire runtime once, as a few bundled modules', async () => {
    const fixture = await createEmbedBridgeFixture({ mode: 'dev' })
    try {
      const url = new URL('__sandbox.html?storyId=overlap&variantId=main&embed=true', fixture.bookUrl).href
      // First document may be reloaded by the dep optimizer: measure a later one.
      const cold = await fixture.browser.newPage()
      await cold.goto(url)
      await cold.getByRole('button', { name: 'Bridge book', exact: true }).waitFor({ timeout: 60_000 })
      await cold.close()

      const page = await fixture.browser.newPage()
      await page.addInitScript(() => performance.setResourceTimingBufferSize(100_000))
      await page.goto(url)
      await page.getByRole('button', { name: 'Bridge book', exact: true }).waitFor({ timeout: 60_000 })
      const urls: string[] = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name))
      await page.close()

      const modules = groupHistoireModuleUrls(urls)
      // A second URL (another file or another version query) would be a second
      // instance of its module state in this document.
      // Icons are a separate stateless entry, imported by the controls build.
      expect(modules.get('shared')!.filter(url => !url.includes('/dist/icons/'))).toEqual([expect.stringMatching(/\/dist\/index\.js\?/)])
      expect(modules.get('protocol')).toEqual([expect.stringMatching(/\/dist\/index\.js\?/)])
      expect(modules.get('histoire')!.length).toBeLessThanOrEqual(5)
      expect(modules.get('plugin-vue')!.length).toBeLessThanOrEqual(5)
      const total = [...modules.values()].reduce((count, list) => count + list.length, 0)
      expect(total).toBeLessThanOrEqual(HISTOIRE_MODULE_BUDGET)
    }
    finally {
      await fixture.close()
    }
  })
})
