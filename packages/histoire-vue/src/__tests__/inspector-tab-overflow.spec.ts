import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isActiveTabCompact } from '../../../histoire-app/src/app/components/inspector/tab-overflow.js'
import { defineWorkbenchPlugin } from '../../../histoire-plugin-kit/src/index.js'
import { pluginEntry } from '../../../histoire/src/node/__tests__/utils/workbench-extensions.js'
import { resizeObserverFixture } from './fixtures/resize-observer.js'
import { FrameProbe, storyInspectorFixture } from './fixtures/story-inspector.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Plugin `acme` adding five tabs (`acme:one` ... `acme:five`). */
const manyTabs = defineWorkbenchPlugin({ id: 'acme', apiVersion: 1, setup(api) {
  for (const label of ['One', 'Two', 'Three', 'Four', 'Five']) api.inspector.addTab({ id: label.toLowerCase(), label, icon: 'plug', component: FrameProbe })
} })

/**
 * Models geometry without CSS: every tab is 80px wide, the overflow trigger 28px, and the tab
 * group offers `available` pixels.
 * @param available Width of the tab group.
 */
function tabGeometry(available: number) {
  const observers = resizeObserverFixture()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.getAttribute('role') === 'tab' ? 80 : this.getAttribute('aria-label') === 'More tabs' ? 28 : this.querySelector(':scope > [role="tablist"]') ? available : 0
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 32, width, height: 32, toJSON: () => ({}) }
  })
  return observers
}

/** Tabs shown in the tab row, `*` marking the selected one. */
function inlineTabs(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[role="tab"]:not([hidden])')].map(tab => `${tab.getAttribute('aria-selected') === 'true' ? '*' : ''}${tab.textContent!.trim()}`)
}

/** Labels of the open overflow menu. */
function menuItems(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[role="menu"][aria-label="More tabs"] [role^="menuitem"]')].map(item => item.textContent!.trim())
}

/** Overflow trigger. */
function trigger(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('button[aria-label="More tabs"]')!
}

describe('inspector tab overflow', () => {
  it('moves plugin tabs that do not fit into a menu and keeps the active tab in the row', async () => {
    const geometry = tabGeometry(600)
    const fixture = await storyInspectorFixture({ plugins: [pluginEntry(manyTabs)] })
    await fixture.selectFrame('c')
    geometry.deliver()
    await flushPromises()
    expect(inlineTabs()).toEqual(['*Props', 'Docs', 'Events', 'Tests', 'One', 'Two'])

    trigger().click()
    await flushPromises()
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(menuItems()).toEqual(['Three', 'Four', 'Five'])

    document.querySelector<HTMLButtonElement>('[role="menu"] [role^="menuitem"]:nth-child(2)')!.click()
    await flushPromises()
    expect(fixture.panels[0]).toEqual(['acme:four'])
    expect(menuItems()).toEqual([])
    expect(inlineTabs()).toEqual(['Props', 'Docs', 'Events', 'Tests', 'One', '*Four'])
    expect(fixture.inspector().get('[role="tabpanel"]').text()).toBe('c:0')
    expect(document.activeElement?.textContent?.trim()).toBe('Four')
  })

  it('reaches overflowed tabs with the keyboard', async () => {
    const geometry = tabGeometry(600)
    const fixture = await storyInspectorFixture({ plugins: [pluginEntry(manyTabs)], tabs: ['acme:two'] })
    await fixture.selectFrame('c')
    geometry.deliver()
    await flushPromises()

    // Arrow keys walk every tab, including overflowed ones, which move into the row.
    await fixture.inspector().get('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(fixture.panels[0]).toEqual(['acme:three'])
    expect(inlineTabs()).toContain('*Three')
    expect(document.activeElement?.textContent?.trim()).toBe('Three')

    trigger().focus()
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await flushPromises()
    expect(menuItems()).toEqual(['Two', 'Four', 'Five'])
    expect(document.activeElement?.textContent?.trim()).toBe('Two')
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement?.textContent?.trim()).toBe('Five')
  })

  it('compacts the active plugin tab only when it does not fit next to the built-ins', () => {
    const values = ['', 'docs', 'acme:one', 'acme:two']
    const metrics = (available: number) => ({ widths: new Map([['', 50], ['docs', 50], ['acme:one', 80], ['acme:two', 80]]), available, trigger: 28, gap: 3 })

    expect(isActiveTabCompact(values, metrics(190), 2, 'acme:one')).toBe(false)
    expect(isActiveTabCompact(values, metrics(150), 2, 'acme:one')).toBe(true)
    // Built-in tabs never compact; other plugin tabs simply overflow.
    expect(isActiveTabCompact(values, metrics(150), 2, 'docs')).toBe(false)
    expect(isActiveTabCompact(values, null, 2, 'acme:one')).toBe(false)
  })
})
