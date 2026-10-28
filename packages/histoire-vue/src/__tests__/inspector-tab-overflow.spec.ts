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
  let widthAvailable = available
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.getAttribute('role') === 'tab' ? 80 + (this.querySelector('[aria-label$="unseen events"]') ? 20 : 0) : this.getAttribute('aria-label') === 'More tabs' ? 28 : this.querySelector(':scope > [role="tablist"]') ? widthAvailable : 0
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 32, width, height: 32, toJSON: () => ({}) }
  })
  return {
    ...observers,
    /** Resize the row and notify the inspector. */
    resize(width: number) {
      widthAvailable = width
      observers.deliver()
    },
  }
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
  it('exchanges a built-in tab for a selected overflowed plugin tab', async () => {
    const geometry = tabGeometry(350)
    const fixture = await storyInspectorFixture({ plugins: [pluginEntry(manyTabs)] })
    await fixture.selectFrame('c')
    geometry.deliver()
    await flushPromises()
    expect(inlineTabs()).toEqual(['*Props', 'Docs', 'Events'])

    trigger().click()
    await flushPromises()
    expect(menuItems()).toEqual(['Tests', 'One', 'Two', 'Three', 'Four', 'Five'])
    ;[...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(item => item.textContent?.trim() === 'Four')!.click()
    await flushPromises()
    expect(fixture.panels[0]).toEqual(['acme:four'])
    expect(inlineTabs()).toEqual(['Props', 'Docs', '*Four'])
    expect(document.activeElement?.textContent?.trim()).toBe('Four')

    trigger().click()
    await flushPromises()
    expect(menuItems()).toEqual(['Events', 'Tests', 'One', 'Two', 'Three', 'Five'])
    ;[...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(item => item.textContent?.trim() === 'Events')!.click()
    await flushPromises()
    expect(fixture.panels[0]).toEqual(['acme:four', 'events'])
    expect(inlineTabs()).toEqual(['Props', 'Docs', '*Events'])
    expect(document.activeElement?.textContent?.trim()).toBe('Events')
    await fixture.inspector().get('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(inlineTabs()).toEqual(['Props', 'Docs', '*Tests'])
    expect(document.activeElement?.textContent?.trim()).toBe('Tests')
  })

  it('overflows built-in tabs and restores them when the row grows', async () => {
    const geometry = tabGeometry(200)
    const fixture = await storyInspectorFixture({ plugins: [] })
    await fixture.selectFrame('c')
    geometry.deliver()
    await flushPromises()
    expect(inlineTabs()).toEqual(['*Props', 'Docs'])
    trigger().click()
    await flushPromises()
    expect(menuItems()).toEqual(['Events', 'Tests'])

    geometry.resize(400)
    await flushPromises()
    expect(inlineTabs()).toEqual(['*Props', 'Docs', 'Events', 'Tests'])
    expect(trigger().hidden).toBe(true)
    expect(menuItems()).toEqual([])
  })

  it('reflows a built-in badge after an event and shows its count in the menu', async () => {
    const geometry = tabGeometry(290)
    const fixture = await storyInspectorFixture({ plugins: [], tabs: ['docs'] })
    await fixture.selectFrame('c')
    const surface = fixture.session.mount(document.createElement('div'), { surface: 'preview' })
    await surface.ready
    geometry.deliver()
    await flushPromises()
    expect(inlineTabs()).toEqual(['Props', '*Docs', 'Events'])

    fixture.source.emitEvent()
    await flushPromises()
    expect(fixture.session.getSnapshot().events.items).toHaveLength(1)
    expect(inlineTabs()).toEqual(['Props', '*Docs'])
    trigger().click()
    await flushPromises()
    expect(menuItems()).toEqual(['Events1', 'Tests'])
    expect(document.querySelector('[role="menuitem"] [aria-label="1 unseen events"]')).not.toBeNull()
  })

  it('keeps an active built-in tab selectable at an extremely narrow width', async () => {
    const geometry = tabGeometry(70)
    const fixture = await storyInspectorFixture({ plugins: [], tabs: ['events'] })
    await fixture.selectFrame('c')
    geometry.deliver()
    await flushPromises()
    expect(inlineTabs()).toEqual(['*Events'])
    expect(trigger().hidden).toBe(false)
    expect(fixture.inspector().get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(fixture.inspector().get('[role="tab"][aria-selected="true"]').attributes('id'))
  })

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

  it('compacts an active icon tab only when it cannot fit alongside the menu', () => {
    const metrics = (available: number) => ({ widths: new Map([['', 50], ['docs', 50], ['acme:one', 80], ['acme:two', 80]]), available, trigger: 28, gap: 3 })

    expect(isActiveTabCompact(metrics(111), 'acme:one', true, true)).toBe(false)
    expect(isActiveTabCompact(metrics(110), 'acme:one', true, true)).toBe(true)
    expect(isActiveTabCompact(metrics(70), 'docs', false, true)).toBe(false)
    expect(isActiveTabCompact(metrics(70), 'acme:one', true, false)).toBe(false)
    expect(isActiveTabCompact(null, 'acme:one', true, true)).toBe(false)
  })
})
