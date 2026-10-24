import { access, readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { launchEmbedBrowser, trackPageReloads } from '../../utils/embed/browser.js'
import { createReferencePluginConsumer, expectAuditFindings, serveReferenceBook, writeReferenceBook } from '../../utils/embed/reference-plugin-consumer.js'
import { MCP_REPOSITORY_ROOT } from '../../utils/mcp/cli-project.js'
import { closeMcpFixtures } from '../../utils/mcp/process.js'
import { createMcpProjectFixture } from '../../utils/mcp/project.js'

const cleanup: (() => Promise<unknown>)[] = []
afterAll(() => closeMcpFixtures(cleanup))

/**
 * Opens the variant on the Audit tab and returns the page.
 * @param browser Playwright browser.
 * @param prefix Book URL plus router prefix.
 */
async function openAudit(browser: any, prefix: string) {
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', (error: Error) => errors.push(error.message))
  // Plugin diagnostics are logged as console errors by the standalone workbench.
  page.on('console', (message: any) => message.type() === 'error' && errors.push(message.text()))
  const reloads = trackPageReloads(page)
  await page.goto(`${prefix}story/audit?variantId=issues&tab=reference:audit`)
  // Dev optimizer discoveries may reload the workbench once; probe the settled page.
  await reloads.settled()
  return { page, errors }
}

describe('packed reference plugin consumers', () => {
  it('runs React views in a Vue story project and keeps preferences per project (dev)', async () => {
    const fixture = await createMcpProjectFixture()
    cleanup.push(() => fixture.close())
    const consumer = await createReferencePluginConsumer(fixture.root, 'vue')
    // Installed from its tarball, like any npm plugin: no workspace links or aliases.
    expect((await realpath(join(consumer.root, 'node_modules/histoire-example-plugin-reference'))).startsWith(MCP_REPOSITORY_ROOT)).toBe(false)
    expect(consumer.inventories['histoire-example-plugin-reference']).toEqual(expect.arrayContaining(['package/dist/node.js', 'package/dist/client/react.js', 'package/dist/frame.js']))
    expect(consumer.inventories['histoire-example-plugin-reference'].some((path: string) => /\.(?:vue|svelte|tsx)$/.test(path))).toBe(false)
    const book = await writeReferenceBook(consumer.root, 'vue', 'react', 'history')
    const config = await readFile(join(book, 'histoire.config.ts'), 'utf8')
    const server = await serveReferenceBook(consumer.root, book, 'dev')
    cleanup.push(() => server.close())
    const browser = await launchEmbedBrowser()
    cleanup.push(() => browser.close())

    const { page, errors } = await openAudit(browser, server.url)
    await expectAuditFindings(page, errors)

    // Preferences: written by the settings section, read back after reload, namespaced per
    // plugin and project, and never written to the project config.
    await page.goto(`${server.url}settings/reference:settings`)
    const toggle = page.getByRole('checkbox', { name: 'Issue badges' })
    await expect.poll(() => toggle.isChecked(), { timeout: 30_000 }).toBe(true)
    await toggle.uncheck()
    await page.reload()
    await expect.poll(() => toggle.isChecked(), { timeout: 30_000 }).toBe(false)
    const stored = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.endsWith(':plugin:reference:badges')))
    expect(stored).toEqual([[expect.stringContaining(new URL(server.url).host), 'false']])
    expect(await readFile(join(book, 'histoire.config.ts'), 'utf8')).toBe(config)
    expect(errors).toEqual([])
  })

  it('runs Vue views in a React story project without vue installed (static)', async () => {
    const fixture = await createMcpProjectFixture()
    cleanup.push(() => fixture.close())
    const consumer = await createReferencePluginConsumer(fixture.root, 'react')
    await expect(access(join(consumer.root, 'node_modules/vue'))).rejects.toThrow()
    const book = await writeReferenceBook(consumer.root, 'react', 'vue', 'hash')
    const server = await serveReferenceBook(consumer.root, book, 'static')
    cleanup.push(() => server.close())
    const browser = await launchEmbedBrowser()
    cleanup.push(() => browser.close())

    const { page, errors } = await openAudit(browser, `${server.url}#/`)
    await expectAuditFindings(page, errors)
    // Workbench Vue views render the workbench's own controls (shared Vue and theme scope).
    expect(await page.locator('[data-histoire-contribution="reference:audit"] .histoire-button').count()).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })
})
