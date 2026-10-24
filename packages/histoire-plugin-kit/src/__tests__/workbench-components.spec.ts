// @vitest-environment jsdom
import type { Component } from 'vue'
import type { ViewHost, WorkbenchComponents, WorkbenchState } from '../index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { WORKBENCH_COMPONENTS_KEY } from '../index.js'
import { WorkbenchEmptyState, WorkbenchErrorState, WorkbenchLoadingState, WorkbenchPaneHeader, WorkbenchPaneList } from '../vue/index.js'
import { createTestHost, plugin } from './fixtures/host.js'

/**
 * Mounts `render` in a fresh Vue app, optionally providing host components at the app level.
 * @param render Root render function.
 * @param components Host implementations provided under the shared key.
 */
function renderApp(render: () => ReturnType<typeof h>, components?: WorkbenchComponents): HTMLElement {
  const element = document.createElement('div')
  document.body.append(element)
  const app = createApp(defineComponent(() => render))
  if (components) app.provide(WORKBENCH_COMPONENTS_KEY, components)
  app.mount(element)
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('workbench Vue components', () => {
  it('render the host implementation with the props and slots they were given', () => {
    const received = vi.fn()
    const EmptyState = defineComponent({
      props: { icon: String, title: String },
      setup(props, { slots }) {
        received({ ...props })
        return () => h('div', [`host:${props.title}`, slots.default?.(), slots.actions?.()])
      },
    })
    const element = renderApp(() => h(WorkbenchEmptyState as Component, { icon: 'search', title: 'No matches' }, {
      default: () => 'Nothing found',
      actions: () => h('button', 'Reset'),
    }), { WorkbenchEmptyState: EmptyState })

    expect(received).toHaveBeenCalledWith({ icon: 'search', title: 'No matches' })
    expect(element.textContent).toBe('host:No matchesNothing foundReset')
  })

  it('fall back to accessible markup for components the host does not provide', () => {
    const element = renderApp(() => h('div', [
      h(WorkbenchPaneHeader as Component, { title: 'Audit' }, () => h('button', 'Run')),
      h(WorkbenchPaneList as Component, null, () => h('ul', h('li', 'Row'))),
      h(WorkbenchLoadingState as Component, { title: 'Loading audit' }),
      h(WorkbenchErrorState as Component, { title: 'Audit failed' }, { default: () => 'Timeout', actions: () => h('button', 'Retry') }),
    ]), {})

    expect(element.querySelector('h2')?.textContent).toBe('Audit')
    expect(element.textContent).toContain('Run')
    expect(element.textContent).toContain('Row')
    expect(element.querySelector('[role="status"]')?.textContent).toBe('Loading audit')
    const alert = element.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Audit failed')
    expect(alert?.textContent).toContain('Timeout')
    expect(alert?.querySelector('button')?.textContent).toBe('Retry')
  })
})

describe('view host states', () => {
  /**
   * Mounts a DOM pane whose view keeps its host, and returns both.
   * @param renderState Host renderer passed as mount option, if any.
   */
  async function mountPane(renderState?: ViewHost['renderState']) {
    let viewHost!: ViewHost
    const host = createTestHost([plugin('acme', (api) => {
      api.shell.addPane({ id: 'pane', label: 'Pane', icon: 'plug', mount(_container, _context, given) {
        viewHost = given
      } })
    })])
    await host.ready
    const container = document.createElement('div')
    document.body.append(container)
    await host.mount('acme:pane', container, host.context, { renderState }).ready
    return { viewHost, container }
  }

  it('render plain accessible markup when the host has no renderer, and clear it with null', async () => {
    const { viewHost, container } = await mountPane()
    const target = document.createElement('div')
    container.append(target)

    viewHost.renderState(target, { kind: 'empty', icon: 'search', title: 'No issues', detail: 'All targets pass' })
    expect(target.querySelector('[role="status"]')?.textContent).toContain('No issues')
    expect(target.textContent).toContain('All targets pass')

    viewHost.renderState(target, { kind: 'error', title: 'Audit failed' })
    expect(target.querySelector('[role="status"]')).toBeNull()
    expect(target.querySelector('[role="alert"]')?.textContent).toBe('Audit failed')

    viewHost.renderState(target, null)
    expect(target.childNodes).toHaveLength(0)
  })

  it('delegate to the renderer the embedding host passes', async () => {
    const renderState = vi.fn()
    const { viewHost } = await mountPane(renderState)
    const target = document.createElement('div')
    const state: WorkbenchState = { kind: 'loading', title: 'Auditing' }

    viewHost.renderState(target, state)

    expect(renderState).toHaveBeenCalledWith(target, state)
  })
})
