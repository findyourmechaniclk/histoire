import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHistoireProject } from 'histoire/node'
import { chromium } from 'playwright'
import { describe, expect, it } from 'vitest'
import { createMcpInspectionProject } from '../../utils/mcp/inspection-project.js'

const story = `<template><Story id="audit"><Variant id="broken"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="></Variant><Variant id="good"><img alt="Example" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="></Variant></Story></template>`

/** Exercise the actual generated module while a story owns the same global name. */
async function verifyAxeGlobalIsolation(url: string) {
  const browser = await chromium.launch({ headless: true })
  try {
    const absent = await browser.newPage()
    await absent.goto(url)
    const unmodified = await absent.evaluate(`(async () => {
      const before = Object.hasOwn(window, 'axe')
      const engine = await import('/book/@id/__x00__virtual:$histoire-axe-engine')
      return { before, after: Object.hasOwn(window, 'axe'), version: engine.default.version }
    })()`)
    expect(unmodified).toEqual({ before: false, after: false, version: '4.14.0' })

    const existing = await browser.newPage()
    await existing.goto(url)
    const preserved = await existing.evaluate(`(async () => {
      const getter = () => { throw new Error('story getter invoked') }
      Object.defineProperty(window, 'axe', { configurable: true, get: getter })
      const engine = await import('/book/@id/__x00__virtual:$histoire-axe-engine')
      return { preserved: Object.getOwnPropertyDescriptor(window, 'axe').get === getter, version: engine.default.version }
    })()`)
    expect(preserved).toEqual({ preserved: true, version: '4.14.0' })

    const successor = await browser.newPage()
    await successor.goto(url)
    const release = Promise.withResolvers<void>()
    let requested = false
    await successor.route('**/*histoire-axe-engine*', async (route) => {
      requested = true
      await release.promise
      await route.continue()
    })
    try {
      await successor.evaluate(`(() => {
        window.axe = { owner: 'original' }
        window.pendingAxe = import('/book/@id/__x00__virtual:$histoire-axe-engine')
      })()`)
      await expect.poll(() => requested, { timeout: 10_000 }).toBe(true)
      await successor.evaluate(`window.axe = window.successor = { owner: 'successor' }`)
      release.resolve()
      const result = await successor.evaluate(`window.pendingAxe.then(engine => ({ preserved: window.axe === window.successor, version: engine.default.version }))`)
      expect(result).toEqual({ preserved: true, version: '4.14.0' })
    }
    finally { release.resolve() }

    const failed = await browser.newPage()
    await failed.goto(url)
    await failed.route('**/*histoire-axe-engine*', route => route.abort())
    const failedLoad = await failed.evaluate(`(async () => {
      const getter = () => { throw new Error('story getter invoked') }
      Object.defineProperty(window, 'axe', { configurable: true, get: getter })
      const rejected = await import('/book/@id/__x00__virtual:$histoire-axe-engine').then(() => false, () => true)
      return { rejected, preserved: Object.getOwnPropertyDescriptor(window, 'axe').get === getter }
    })()`)
    expect(failedLoad).toEqual({ rejected: true, preserved: true })
  }
  finally { await browser.close() }
}

describe('isolated Node accessibility audit', () => {
  it('requires opt-in and scans only fresh story content in dev and built sources', async () => {
    const fixture = await createMcpInspectionProject()
    let project: Awaited<ReturnType<typeof createHistoireProject>> | undefined
    try {
      const config = join(fixture.root, 'custom config.ts')
      const disabled = (await readFile(config, 'utf8')).replace('mcp:true', 'mcp:false').replace('build:{target:\'node\'}', 'build:{target:\'static\'}')
      await writeFile(config, disabled)
      await writeFile(join(fixture.root, 'Deterministic.story.vue'), story)
      project = await createHistoireProject({ root: fixture.root, configFile: 'custom config.ts' })
      const target = { source: 'dev' as const, storyId: 'audit', variantId: 'broken' }
      const first = await project.startDev({ host: '127.0.0.1', port: 0 })
      await first.ready
      await expect(project.inspect.accessibility(target)).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
      await first.close()

      await writeFile(config, disabled.replace('export default {', 'export default {inspection:{enabled:true,accessibility:true},'))
      const dev = await project.startDev({ host: '127.0.0.1', port: 0 })
      await dev.ready
      await verifyAxeGlobalIsolation(dev.url)
      const broken = await project.inspect.accessibility(target)
      expect(broken).toMatchObject({ mode: 'isolated', inspection: 'accessibility', matched: true, engine: 'axe-core', engineVersion: expect.any(String) })
      expect(broken.violations.map(finding => finding.id)).toContain('image-alt')
      const good = await project.inspect.accessibility({ ...target, variantId: 'good' })
      expect(good.violations.map(finding => finding.id)).not.toContain('image-alt')
      await expect(project.inspect.accessibility({ ...target, selector: '#missing' })).resolves.toMatchObject({ matched: false, violations: [] })
      await expect(project.inspect.accessibility({ ...target, selector: '[' })).rejects.toMatchObject({ code: 'INVALID_SELECTOR' })
      const aria = await project.inspect.aria(target)
      expect(aria).toMatchObject({ inspection: 'accessibility', matched: true, snapshot: expect.any(String) })
      expect(aria).not.toHaveProperty('engine')

      await dev.close()
      await project.build()
      const built = await project.preview({ host: '127.0.0.1', port: 0 })
      await built.ready
      const isolated = await project.inspect.accessibility({ ...target, source: 'preview' })
      expect(isolated.violations.map(finding => finding.id)).toContain('image-alt')
      expect(isolated.source.epoch).not.toBe(broken.source.epoch)
      await expect(project.inspect.accessibility({ ...target, source: 'preview', expectedRevision: broken.source.revision })).rejects.toMatchObject({ code: 'STALE_REVISION' })
    }
    finally {
      await project?.close()
      await fixture.close()
    }
  }, 120_000)
})
