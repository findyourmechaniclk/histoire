import { changedSource, embed, events, expect, inspector, measure, overlay, propsControls, search, viewport } from './capture-actions.mjs'

/**
 * @typedef {object} CaptureMode
 * @property {number} width Viewport width in CSS pixels.
 * @property {number} height Viewport height in CSS pixels.
 * @property {boolean} dark App appearance preference.
 * @property {'comfortable' | 'compact'} density App density preference.
 */

/**
 * @typedef {object} CaptureScreen
 * @property {string} name Stable filename stem and glob target.
 * @property {string} path Exact standalone route and selection query.
 * @property {boolean} [canvas] Whether ordinary frame readiness applies.
 * @property {string} [pane] Side pane to open, including on narrow viewports.
 * @property {boolean} [inspector] Whether narrow mode opens the inspector.
 * @property {string} [wait] Surface selector that must become visible.
 * @property {(page: import('playwright').Page) => Promise<void>} [setup] Real UI actions and readiness checks.
 */

/** Stable fixture identities generated from committed vue3 story paths. */
const button = 'src-components-basebutton-story-vue'
const demo = 'src-components-demo-story-vue'
/** Explicit variant selection avoids remembered selections and chooser defaults. */
function story(id, query = '', variant = `${id}-0`) {
  return `/story/${id}?variantId=${variant}&arrange=grid${query}`
}
/**
 * Supported screenshot modes; compact and narrow are separate light-mode cases.
 * @type {Record<string, CaptureMode>}
 */
export const modes = {
  light: { width: 1440, height: 900, dark: false, density: 'comfortable' },
  dark: { width: 1440, height: 900, dark: true, density: 'comfortable' },
  compact: { width: 1440, height: 900, dark: false, density: 'compact' },
  narrow: { width: 375, height: 812, dark: false, density: 'comfortable' },
}

/**
 * Static-book portion of validation.md's browser matrix; each case owns fresh storage.
 * @type {CaptureScreen[]}
 */
export const screens = [
  { name: 'home', path: '/', wait: '.histoire-home-page', canvas: false, setup: async (page) => { await expect(page.getByRole('heading', { name: 'Browse', exact: true })).toBeVisible() } },
  { name: 'canvas-grid', path: story(button) },
  { name: 'canvas-list', path: story(button).replace('arrange=grid', 'arrange=list') },
  { name: 'canvas-single', path: story(button).replace('arrange=grid', 'arrange=single') },
  { name: 'canvas-matrix', path: story('src-components-workbenchmatrix-story-vue', '&rows=enabled&cols=emphasized', 'default').replace('arrange=grid', 'arrange=matrix'), canvas: false, setup: async (page) => {
    await expect(page.locator('.histoire-matrix-cell')).toHaveCount(4)
    await expect(page.locator('.histoire-matrix-cell-loading')).toHaveCount(0)
    await expect(page.frameLocator('.histoire-matrix-cell iframe').first().locator('[data-test-id="matrix-values"]')).toBeVisible()
    await page.locator('.histoire-matrix-cell-select').first().click()
  } },
  { name: 'canvas-measure', path: story(button), setup: measure },
  { name: 'toolbar-overflow', path: story(button), setup: async (page) => {
    await page.getByRole('button', { name: 'More canvas tools', exact: true }).click()
    await expect(page.getByRole('menu').first()).toBeVisible()
  } },
  { name: 'toolbar-viewport', path: story(button), setup: viewport },
  { name: 'inspector-props', path: story(button), inspector: true, setup: propsControls },
  { name: 'inspector-docs', path: story(demo, '&tab=docs'), inspector: true, setup: async (page) => {
    await inspector(page)
    await expect(page.getByRole('heading', { name: 'Message', exact: true })).toBeVisible()
  } },
  { name: 'inspector-events', path: story('src-components-eventbutton-story-vue', '', '_default'), setup: events },
  { name: 'source-changed', path: story(demo), inspector: true, setup: changedSource },
  { name: 'stories', path: story('src-components-controls-story-vue'), pane: 'stories' },
  { name: 'search-results', path: story(button), pane: 'search', setup: page => search(page, false) },
  { name: 'search-empty', path: story(button), pane: 'search', setup: page => search(page, true) },
  { name: 'settings-general', path: '/settings/general', canvas: false, wait: '.histoire-settings-content', setup: async (page) => { await expect(page.getByRole('heading', { name: 'General', exact: true })).toBeVisible() } },
  { name: 'settings-appearance', path: '/settings/appearance', canvas: false, wait: '.histoire-settings-content', setup: async (page) => { await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible() } },
  { name: 'settings-plugin', path: '/settings/reference:settings', canvas: false, wait: '.histoire-settings-plugin', setup: async (page) => { await expect(page.getByRole('checkbox', { name: 'Issue badges', exact: true })).toBeVisible() } },
  { name: 'markdown', path: '/story/src-longfile1-story-js', canvas: false, wait: '.histoire-markdown-page', setup: async (page) => { await expect(page.getByRole('heading', { name: 'How to write stories?', exact: true })).toBeVisible() } },
  { name: 'embed-dialog', path: story(button), setup: embed },
  // A single active frame avoids the plugin's intentional completion-order audit list.
  { name: 'plugin-pane', path: story(button).replace('arrange=grid', 'arrange=single'), pane: 'reference:overview' },
  { name: 'plugin-inspector', path: story(button, '&tab=reference:audit'), inspector: true, setup: inspector },
  { name: 'plugin-overlay', path: story(button), setup: overlay },
  { name: 'plugin-view', path: story(button).replace('arrange=grid', 'arrange=reference:compare'), wait: '[data-histoire-canvas-view]', canvas: false, setup: async (page) => {
    for (const [index, name] of ['Click me', 'Click me', 'Click me!'].entries()) await expect(page.frameLocator('.hst-ref-compare-frame iframe').nth(index).locator('[data-test-id="sandbox-render"]').getByRole('button', { name, exact: true })).toBeVisible()
  } },
  { name: 'coexistence-v3', path: story('tailwind', '', 'box-shadow').replace('arrange=grid', 'arrange=single'), setup: async (page) => {
    await expect(page.frameLocator('iframe:not([src*="controls=true"])').first().locator('[data-tailwind-token]').first()).toBeVisible()
  } },
]

/**
 * Nuxt UI fixture uses a deliberately authored stable story/variant ID.
 * @type {CaptureScreen[]}
 */
export const nuxtScreens = [
  { name: 'coexistence-v4', path: story('nuxt-ui-rstore', '', 'main'), setup: async (page) => {
    const frame = page.frameLocator('iframe:not([src*="controls=true"])').first().locator('[data-test-id="sandbox-render"]')
    await expect(frame.getByRole('button', { name: 'Show toast' })).toBeVisible()
    await expect(frame.getByRole('list', { name: 'Fixture items' })).toBeVisible()
  } },
]
