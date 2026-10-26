import { requireExample } from './dependencies.mjs'

/** Playwright assertions wait for real mounted UI rather than fixed startup delays. */
export const expect = requireExample('playwright/test').expect.configure({ timeout: 20000 })

/** Reach toolbar actions whether inline or in their responsive overflow menu. */
export async function toolbar(page, name) {
  const button = page.getByRole('button', { name, exact: true })
  if (await button.isVisible()) return button.click()
  await page.getByRole('button', { name: 'More canvas tools', exact: true }).click()
  await page.getByRole('menuitem', { name, exact: true }).or(page.getByRole('menuitemradio', { name, exact: true })).click()
}

/** Wait for canonical content and admitted frames; virtualized placeholders stay unloaded. */
export async function ready(page) {
  await expect(page.locator('.histoire-frame-content').first()).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.histoire-frame-content[aria-busy="true"]:has(iframe)')).toHaveCount(0)
}

/** Responsive inspector overlays open only after the canvas is ready. */
export async function inspector(page) {
  if (!await page.getByRole('button', { name: 'Close inspector', exact: true }).isVisible()) await toolbar(page, 'Show inspector')
}

/** Wait for authored BaseButton controls in their isolated document. */
export async function propsControls(page) {
  await inspector(page)
  await expect(page.frameLocator('iframe[src*="controls=true"]').getByText('Disabled', { exact: true })).toBeVisible()
}

/** Expand source, then edit through public Props UI to exercise changed-line highlighting. */
export async function changedSource(page) {
  await inspector(page)
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(page.locator('.histoire-source-content')).toContainText('Hello world!')
  await page.getByRole('textbox', { name: 'message', exact: true }).fill('Baseline message')
  await expect(page.locator('.histoire-source-content')).toContainText('Baseline message')
  await expect(page.locator('.line[data-source-changed]').first()).toBeVisible()
}

/** Emit one real story event and inspect it; frozen wall time keeps its timestamp stable. */
export async function events(page) {
  const frame = page.frameLocator('iframe:not([src*="controls=true"])').first()
  await frame.locator('[data-test-id="sandbox-render"]').getByRole('button', { name: 'Click', exact: true }).click()
  await inspector(page)
  await page.getByRole('tab', { name: /^Events/ }).click()
  await expect(page.locator('.histoire-event-row').first()).toBeVisible()
}

/** Search has an asynchronous index; wait for the result or explicit empty state. */
export async function search(page, empty) {
  await page.getByRole('searchbox', { name: 'Search stories, docs and props', exact: true }).fill(empty ? 'baseline-no-such-story-7391' : 'BaseButton')
  await expect(page.locator('section[aria-label="Search"]')).toHaveAttribute('aria-busy', 'false')
  if (empty) await expect(page.getByText('No matches', { exact: true })).toBeVisible()
  else await expect(page.locator('[data-test-id="search-item"]').first()).toBeVisible()
}

/** Lock an actual measurement so box model and breadcrumb controls remain visible. */
export async function measure(page) {
  await page.locator('.histoire-frame-label').first().click()
  await expect(page.getByRole('button', { name: 'Measure', exact: true })).toBeEnabled()
  await toolbar(page, 'Measure')
  const frame = page.locator('iframe:not([src*="controls=true"])').first()
  const box = await frame.boundingBox()
  if (!box) throw new Error('Missing measurable frame')
  await page.mouse.move(box.x + 35, box.y + 35)
  await expect(page.locator('.histoire-measure-box').first()).toBeVisible()
  await page.mouse.click(box.x + 35, box.y + 35)
  await expect(page.getByRole('toolbar', { name: 'Locked measurement' })).toBeVisible()
}

/** Open the real embedding dialog, including its disabled-configuration state. */
export async function embed(page) {
  await toolbar(page, 'Embed')
  await page.getByRole('button', { name: 'Embed this variant', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/** Open viewport controls as a representative toolbar popover. */
export async function viewport(page) {
  await toolbar(page, 'Viewport')
  await expect(page.getByRole('textbox', { name: 'Custom width', exact: true })).toBeVisible()
}

/** Capture plugin-owned overlay after its real frame audit has published. */
export async function overlay(page) {
  await expect(page.locator('.hst-ref-frame-badge').first()).toBeVisible()
}
