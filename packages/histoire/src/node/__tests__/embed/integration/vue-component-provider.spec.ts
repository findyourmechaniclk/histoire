import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { describe, expect, it } from 'vitest'

/** Runs the actual provider and Vue DOM in Chromium, not the workbench shell. */
describe('vue component ownership in Chromium', () => {
  it('maps the selected mounted instance and retires removed and disposed owners', async () => {
    const root = resolve(import.meta.dirname, '../../../../../../..')
    const server = await createServer({ configFile: false, root, logLevel: 'silent', resolve: { alias: { '@histoire/shared/inspection': resolve(root, 'packages/histoire-shared/src/inspection/index.ts') } }, server: { host: '127.0.0.1', port: 0 } })
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      await server.listen()
      browser = await chromium.launch({ headless: true })
      const page = await browser.newPage()
      await page.goto(`${server.resolvedUrls!.local[0]}packages/histoire-plugin-vue/src/client/inspection/browser-fixture.html`)
      await page.waitForFunction(() => Boolean((window as any).fixture))
      const first = await page.evaluate(() => (window as any).fixture.inspect('[data-label="first"]'))
      const second = await page.evaluate(() => (window as any).fixture.inspect('[data-label="second"]'))
      expect(first.node.name).toBe('BrowserChild')
      expect(second.node.name).toBe('BrowserChild')
      expect(first.node.id).not.toBe(second.node.id)
      expect((await page.evaluate(id => (window as any).fixture.component(id), second.node.id)).props).toEqual({ label: 'second' })
      await page.evaluate(() => (window as any).fixture.hide())
      expect(await page.evaluate((id) => {
        try {
          (window as any).fixture.component(id)
          return 'accepted'
        }
        catch (error) { return (error as Error).message }
      }, second.node.id)).toBe('RUNTIME_CHANGED')
      expect((await page.evaluate(id => (window as any).fixture.component(id), first.node.id)).props).toEqual({ label: 'first' })
      await page.evaluate(() => (window as any).fixture.dispose())
      expect(await page.evaluate((id) => {
        try {
          (window as any).fixture.component(id)
          return 'accepted'
        }
        catch (error) { return (error as Error).message }
      }, first.node.id)).toBe('RUNTIME_CHANGED')
    }
    finally {
      await browser?.close()
      await server.close()
    }
  }, 30_000)
})
