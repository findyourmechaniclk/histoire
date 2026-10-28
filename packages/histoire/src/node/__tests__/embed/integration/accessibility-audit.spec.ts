import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../../../../..')
let axePath = process.env.HISTOIRE_AXE_TEST_PATH
try {
  axePath ??= createRequire(resolve(root, 'packages/histoire/package.json')).resolve('axe-core/axe.min.js')
}
catch { /* Optional engine is absent; other browser coverage remains available. */ }

/** Runs real axe in the story document and excludes a matching shell issue. */
describe.skipIf(!axePath)('story-scoped accessibility audit', () => {
  it('reports a story violation, excludes shell, and observes live repairs', async () => {
    const server = await createServer({ configFile: false, root, logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } })
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      await server.listen()
      browser = await chromium.launch({ headless: true })
      const page = await browser.newPage()
      await page.goto(`${server.resolvedUrls!.local[0]}packages/histoire/src/node/__tests__/fixtures/accessibility-audit/index.html`)
      await page.addScriptTag({ path: axePath! })
      await page.waitForFunction(() => Boolean((window as any).fixture))
      const report = await page.evaluate(() => (window as any).fixture.scan())
      const images = report.violations.find((finding: any) => finding.id === 'image-alt')
      expect(images.nodes).toHaveLength(1)
      expect(JSON.stringify(images)).toContain('story-image')
      expect(JSON.stringify(report)).not.toContain('shell-image')
      expect(report.engine).toBe('axe-core')
      const invalidAria = report.violations.find((finding: any) => finding.id === 'aria-valid-attr-value')
      const named = invalidAria.nodes.find((node: any) => node.selectors.some((selector: string) => selector.includes('named')))
      expect(named).toBeDefined()
      expect(named).not.toHaveProperty('accessibleName')
      await page.evaluate(() => (window as any).fixture.repair())
      const repaired = await page.evaluate(() => (window as any).fixture.scan())
      expect(repaired.violations.some((finding: any) => finding.id === 'image-alt')).toBe(false)
      const missing = await page.evaluate(() => (window as any).fixture.scan('#absent'))
      expect(missing).toMatchObject({ matched: false, violations: [], incomplete: [] })
      await page.evaluate(() => (window as any).fixture.startHeld(10000))
      await page.evaluate(() => (window as any).fixture.cancel())
      expect(await page.evaluate(() => (window as any).fixture.result())).toBe('CANCELLED')
      expect(await page.evaluate(async () => {
        try {
          await (window as any).fixture.scan()
          return 'accepted'
        }
        catch (error) { return (error as any).code }
      })).toBe('CAPABILITY_UNAVAILABLE')
      await page.evaluate(() => (window as any).fixture.release())
      await expect.poll(() => page.evaluate(async () => {
        try {
          await (window as any).fixture.scan()
          return 'available'
        }
        catch { return 'busy' }
      })).toBe('available')
      expect(await page.evaluate(() => (window as any).fixture.missingEngine())).toBe('CAPABILITY_UNAVAILABLE')
      await page.evaluate(() => (window as any).fixture.startHeld(20))
      expect(await page.evaluate(() => (window as any).fixture.result())).toBe('TIMEOUT')
      await page.evaluate(() => (window as any).fixture.release())
      await expect.poll(() => page.evaluate(async () => {
        try {
          await (window as any).fixture.scan()
          return 'available'
        }
        catch { return 'busy' }
      })).toBe('available')
      await page.evaluate(() => (window as any).fixture.startHeld(10000))
      await page.evaluate(() => {
        (window as any).fixture.retire()
        ;(window as any).fixture.release()
      })
      expect(await page.evaluate(() => (window as any).fixture.result())).toBe('RUNTIME_CHANGED')
    }
    finally {
      await browser?.close()
      await server.close()
    }
  }, 30_000)
})
