// @vitest-environment node
import { access, readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it.each([
  '../../../histoire-app/dist/style.css',
  '../../dist/style-standalone.css',
  '../../dist/peer/style.css',
])('ships readable local fonts beside %s', async (entry) => {
  const sheet = new URL(entry, import.meta.url)
  const css = await readFile(sheet, 'utf8')
  const fonts = [...css.matchAll(/url\(['"]?([^)'"\s]+\.woff2)['"]?\)/g)].map(match => match[1])
  expect(fonts.length).toBeGreaterThan(0)
  for (const font of fonts) {
    const asset = new URL(font, sheet)
    expect(asset.href.startsWith(new URL('./fonts/', sheet).href), `Font escapes published assets: ${font}`).toBe(true)
    await expect(access(asset), `Missing published font ${font}`).resolves.toBeUndefined()
  }
})
