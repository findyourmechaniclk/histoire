import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { requireExample, requireHistoire } from './dependencies.mjs'

/** Exercise generated CSS in a real browser without a dev-server dependency. */
async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' } } })
  const requireControls = createRequire(new URL('../../../packages/histoire-controls/package.json', import.meta.url))
  const requireRoot = createRequire(new URL('../../../package.json', import.meta.url))
  const postcss = requireHistoire('postcss')
  const v4 = requireControls('@tailwindcss/postcss')
  const appConfig = createRequire(new URL('../../../packages/histoire-app/package.json', import.meta.url))('./postcss.config.cjs')
  const from = new URL('../../../packages/histoire-app/src/app/style/main.css', import.meta.url).pathname
  const appSource = await readFile(from, 'utf8')
  const candidates = ['bg-accent/15', 'bg-accent-soft/15', 'dark:bg-surface', 'translate-x-1', 'ring-2', 'shadow-sm'].map(name => `htw:${name}`)
  const app = await postcss(appConfig.plugins).process(`${appSource}\n@source inline("${candidates.join(' ')}");`, { from })
  const v3 = await postcss([requireRoot('tailwindcss')({
    content: [{ raw: 'translate-x-8 ring-4 shadow-xl', extension: 'html' }],
    corePlugins: { preflight: false },
    experimental: { optimizeUniversalDefaults: true },
  })]).process('@tailwind base; @tailwind utilities;', { from: undefined })
  const storyV4 = await postcss([v4()]).process('@import "tailwindcss/theme.css" layer(theme) prefix(story); @import "tailwindcss/utilities.css" layer(utilities) prefix(story); @source inline("story:translate-x-8 story:ring-4 story:shadow-xl");', { from })
  const peerFrom = new URL('../../../packages/histoire-controls/src/style/peer.css', import.meta.url).pathname
  const peer = await postcss(requireControls('./postcss.peer.config.cjs').plugins).process(`${await readFile(peerFrom, 'utf8')}\n@source inline("htw:translate-x-1 htw:ring-2 htw:shadow-sm");`, { from: peerFrom })
  const standaloneFrom = new URL('../../../packages/histoire-controls/src/style/main.css', import.meta.url).pathname
  const standalone = await postcss(requireControls('./postcss.config.cjs').plugins).process(`${await readFile(standaloneFrom, 'utf8')}\n@source inline("htw:text-primary-500 htw:text-gray-700");`, { from: standaloneFrom })
  const { chromium } = requireExample('playwright')
  const browser = await chromium.launch({ headless: true, chromiumSandbox: false })
  const results = []
  try {
    for (const [version, storyCss, classes, order] of [
      ['v3', v3.css, 'translate-x-8 ring-4 shadow-xl'],
      ['v4', storyV4.css, 'story:translate-x-8 story:ring-4 story:shadow-xl'],
    ].flatMap(entry => ['story-first', 'histoire-first'].map(order => [...entry, order]))) {
      const page = await browser.newPage()
      await page.setContent(`<div class="histoire-provider"><div class="histoire-root" data-histoire-appearance="dark"><div id="chrome" class="htw:dark:bg-surface"></div><div id="accent" class="htw:bg-accent/15"></div><div id="soft" class="htw:bg-accent-soft/15"></div><div class="__histoire-render-story"><div id="story" class="${classes}" style="color: rgb(40 50 60)">Story</div></div></div></div><div class="histoire-provider" id="peer"><div id="peer-child" class="htw:translate-x-1 htw:ring-2 htw:shadow-sm"></div></div>`)
      await page.addStyleTag({ content: storyCss })
      /** Read browser-computed composed effects rather than selector spelling. */
      const sample = () => page.locator('#story').evaluate((element) => {
        const style = getComputedStyle(element)
        return { transform: style.transform, translate: style.translate, shadow: style.boxShadow }
      })
      const before = await sample()
      assert.notEqual(before.shadow, 'none', `${version} fixture has a real shadow and ring`)
      assert.equal(version === 'v4' ? before.translate : before.transform, version === 'v4' ? '32px' : 'matrix(1, 0, 0, 1, 32, 0)')
      await page.addStyleTag({ content: app.css })
      await page.addStyleTag({ content: peer.css })
      if (order === 'histoire-first') {
        await page.evaluate(() => document.head.append(document.head.querySelector('style')))
      }
      const after = await sample()
      assert.deepEqual(after, before, `${version} story effects survive app and peer styles`)
      const chrome = await page.locator('#chrome').evaluate(element => getComputedStyle(element).backgroundColor)
      assert.equal(chrome, 'rgb(22, 23, 27)', 'Embedded data-appearance activates dark utility')
      const colors = await page.locator('#accent, #soft').evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundColor))
      // Compare rendered colors against independently authored alpha composition.
      const canvas = await page.evaluate((colors) => {
        const context = document.createElement('canvas').getContext('2d')
        return colors.map((color) => {
          context.clearRect(0, 0, 1, 1)
          context.fillStyle = color
          context.fillRect(0, 0, 1, 1)
          return [...context.getImageData(0, 0, 1, 1).data]
        })
      }, [...colors, 'rgb(52 211 153 / .15)', 'rgb(52 211 153 / .018)'])
      assert.deepEqual(canvas[0], canvas[2], 'Accent opacity multiplies source alpha')
      assert.deepEqual(canvas[1], canvas[3], 'Soft accent opacity multiplies .12 by .15')
      const peerTranslate = await page.locator('#peer-child').evaluate(element => getComputedStyle(element).translate)
      assert.equal(peerTranslate, '4px', 'Peer theme spacing inherits from provider')
      results.push({ version, order, before, after, chrome, colors, peerTranslate })
      await page.close()
    }
    const isolated = await browser.newPage()
    await isolated.setContent('<div class="histoire-provider"><div id="peer" class="htw:translate-x-1 htw:ring-2 htw:shadow-sm">Peer</div></div>')
    await isolated.addStyleTag({ content: peer.css })
    assert.equal(await isolated.locator('#peer').evaluate(element => getComputedStyle(element).translate), '4px', 'Peer-only theme initializes spacing on its provider')
    await isolated.setContent('<div id="primary" class="htw:text-primary-500">Primary</div><div id="gray" class="htw:text-gray-700">Gray</div>')
    await isolated.addStyleTag({ content: standalone.css })
    const fallback = await isolated.locator('#primary, #gray').evaluateAll(elements => elements.map(element => getComputedStyle(element).color))
    assert.deepEqual(fallback, ['rgb(16, 185, 129)', 'rgb(63, 63, 70)'], 'Standalone controls retain canonical colors without a host')
    await isolated.setContent('<button class="histoire-button" data-color="flat" aria-pressed="true">Control</button>')
    await isolated.addStyleTag({ content: standalone.css })
    const controlBefore = await isolated.locator('button').evaluate(element => ({ background: getComputedStyle(element).backgroundColor, padding: getComputedStyle(element).padding }))
    await isolated.addStyleTag({ content: 'button { background: transparent; padding: 0; }' })
    const controlAfter = await isolated.locator('button').evaluate(element => ({ background: getComputedStyle(element).backgroundColor, padding: getComputedStyle(element).padding }))
    assert.deepEqual(controlAfter, controlBefore, 'Standalone controls retain specificity against an unlayered host reset')
    results.push({ isolatedPeer: 'passed', standaloneColors: fallback, controlBefore, controlAfter })
    await isolated.close()
  }
  finally {
    await browser.close()
  }
  const out = values.out ? resolve(values.out) : new URL('./probe-v4.json', import.meta.url)
  await writeFile(out, `${JSON.stringify(results, null, 2)}\n`)
  process.stdout.write('v3/v4 story effects, embedded dark, alpha, peer spacing and standalone host-reset isolation passed\n')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
