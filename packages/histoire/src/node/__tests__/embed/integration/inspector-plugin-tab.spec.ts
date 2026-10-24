import { describe, expect, it } from 'vitest'
import { createEmbedBridgeFixture } from '../../utils/embed/bridge-fixture.js'
import { trackPageReloads } from '../../utils/embed/browser.js'

const story = '<template><Story id="normal" title="Normal story"><Variant id="one"><button>First</button></Variant><Variant id="two"><button>Second</button></Variant></Story></template>'

/**
 * Project-local workbench plugin. Setup is slow on purpose so the deep link is resolved while
 * plugins are still loading. DOM views print the frame they were given.
 */
const plugin = `
const view = prefix => (element, context) => {
  element.textContent = prefix + ' ' + context.frame.target.variantId
  return { update: next => { element.textContent = prefix + ' ' + next.frame.target.variantId } }
}
export default {
  id: 'probe',
  apiVersion: 1,
  async setup(api) {
    await new Promise(resolve => setTimeout(resolve, 500))
    api.inspector.addTab({ id: 'panel', label: 'Probe', icon: 'plug', mount: view('Probe tab') })
    api.inspector.addSection({ id: 'footer', tab: 'footer', position: 'after', mount: view('Probe footer') })
  },
}
`

describe('inspector plugin tabs in the standalone workbench', () => {
  it.each([{ mode: 'dev', routerMode: 'history' }, { mode: 'static', routerMode: 'hash' }] as const)('keeps a plugin tab deep link through startup and reload ($mode)', async ({ mode, routerMode }) => {
    const fixture = await createEmbedBridgeFixture({
      mode,
      embedding: false,
      story,
      files: { 'plugins/inspector.js': plugin },
      plugins: `{name:'probe',workbench:{id:'probe',apiVersion:1,client:'./plugins/inspector.js'}}`,
      config: `routerMode:'${routerMode}',`,
    })
    const page = await fixture.browser.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const prefix = `${fixture.bookUrl}${routerMode === 'hash' ? '#' : ''}`
    /** Route `?tab=` value, read past the hash router prefix. */
    const tab = () => {
      const url = new URL(page.url())
      return (routerMode === 'hash' ? new URL(url.hash.slice(1), url.origin) : url).searchParams.get('tab')
    }
    const panel = page.getByRole('tabpanel')
    try {
      const reloads = trackPageReloads(page)
      await page.goto(`${prefix}story/normal?variantId=one&tab=probe:panel`)
      if (mode === 'dev') await reloads.settled()
      await expect.poll(() => panel.textContent(), { timeout: 30_000 }).toContain('Probe tab one')
      expect(await page.getByRole('tab', { name: 'Probe', exact: true }).getAttribute('aria-selected')).toBe('true')
      expect(await page.getByText('Probe footer one').count()).toBe(1)
      expect(tab()).toBe('probe:panel')

      await page.reload()
      await expect.poll(() => panel.textContent(), { timeout: 30_000 }).toContain('Probe tab one')
      expect(tab()).toBe('probe:panel')

      // Unknown plugin tabs fall back to Props only once plugin setup settled.
      await page.goto(`${prefix}story/normal?variantId=one&tab=probe:missing`)
      await expect.poll(tab, { timeout: 30_000 }).toBe('')
      expect(await page.getByRole('tab', { name: 'Props', exact: true }).getAttribute('aria-selected')).toBe('true')
      expect(errors).toEqual([])
    }
    finally {
      await page.close()
      await fixture.close()
    }
  })
})
