// @vitest-environment jsdom
import type { MountView, WorkbenchContext } from '../index.js'
import { flushSync as flushSvelte } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { reactView } from '../react/index.js'
import { svelte4View } from '../svelte4/index.js'
import { svelte5View } from '../svelte5/index.js'
import { vueView } from '../vue/mount.js'
import { createTestHost, plugin } from './fixtures/host.js'
import { probe } from './fixtures/views/probe.js'
import Svelte4View from './fixtures/views/View.v4.svelte'
import Svelte5View from './fixtures/views/View.v5.svelte'
import { ReactView, VueView } from './fixtures/views/views.js'

/** Lets framework schedulers (Vue, Svelte 5 effects) flush. */
async function settle() {
  await new Promise(resolve => setTimeout(resolve))
  flushSvelte()
}

afterEach(() => {
  document.body.replaceChildren()
})

describe.each([
  { name: 'React', view: reactView(ReactView) },
  { name: 'Svelte 4', view: svelte4View(Svelte4View) },
  { name: 'Svelte 5', view: svelte5View(Svelte5View) },
  { name: 'isolated Vue app', view: vueView(VueView) },
] as Array<{ name: string, view: MountView<WorkbenchContext> }>)('$name adapter', ({ view }) => {
  it('mounts, updates without remounting, and cleans up on disposal', async () => {
    const host = createTestHost([plugin('acme', (api) => {
      api.shell.addPane({ id: 'pane', label: 'Pane', icon: 'plug', ...view })
    })])
    await host.ready
    const container = document.createElement('div')
    const overlayRoot = document.createElement('div')
    document.body.append(container, overlayRoot)
    const button = () => container.querySelector('button')!

    const mounted = host.mount('acme:pane', container, { ...host.context, tag: 'a' }, { overlayRoot })
    await mounted.ready
    await settle()
    expect(button().textContent).toBe('a:0')
    expect(overlayRoot.textContent).toBe('portal')

    button().click()
    await settle()
    mounted.update({ ...host.context, tag: 'b' })
    await settle()
    // Local state survives context updates: same component instance.
    expect(button().textContent).toBe('b:1')

    window.dispatchEvent(new KeyboardEvent('keydown'))
    const keys = probe.keys
    expect(keys).toBeGreaterThan(0)
    await mounted.dispose()
    await settle()
    window.dispatchEvent(new KeyboardEvent('keydown'))
    expect(probe.keys).toBe(keys)
    expect(container.childElementCount).toBe(0)
    expect(overlayRoot.childElementCount).toBe(0)
    expect(host.diagnostics()).toEqual([])
  })
})
