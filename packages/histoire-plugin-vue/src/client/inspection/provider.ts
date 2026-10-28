import type { App, ComponentInternalInstance } from 'vue'
import { projectVariantState } from '@histoire/shared/inspection'
import { resolveVueComponentElement } from './component-element.js'
import { traverseVueInstances } from './traverse.js'

/** One per-mounted-app provider; only detached data leaves this closure. */
export function createVueInspectionProvider(app: App, root: Element) {
  const instance = app._instance
  const ids = new WeakMap<ComponentInternalInstance, string>()
  const prefix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  let counter = 0
  let disposed = false

  /** Reject retired apps even when their old container remains in the document. */
  function assertActive() {
    if (disposed || !root.isConnected || !instance || app._instance !== instance || app._container !== root || (root as any).__vue_app__ !== app || instance.isUnmounted) {
      throw Object.assign(new Error('RUNTIME_CHANGED'), { code: 'RUNTIME_CHANGED' })
    }
  }

  /** Instance IDs are private to this provider and never reused after remount. */
  function id(value: ComponentInternalInstance) {
    let result = ids.get(value)
    if (!result) {
      result = `${prefix}-${++counter}`
      ids.set(value, result)
    }
    return result
  }

  /** Project framework data without returning instances or unverified source paths. */
  function node(value: ComponentInternalInstance, parent: ComponentInternalInstance | null) {
    const type = value.type as object
    const nameProperty = Object.getOwnPropertyDescriptor(type, 'name')
    const internalNameProperty = Object.getOwnPropertyDescriptor(type, '__name')
    const name = nameProperty && 'value' in nameProperty && typeof nameProperty.value === 'string'
      ? nameProperty.value
      : internalNameProperty && 'value' in internalNameProperty && typeof internalNameProperty.value === 'string' ? internalNameProperty.value : 'Anonymous'
    return { id: id(value), parentId: parent ? id(parent) : null, name: name.slice(0, 256), framework: 'vue' }
  }

  /** Enforce hard limits even when called outside a validated transport. */
  function read(element: Element | null = null, maxNodes = 500, maxDepth = 20) {
    assertActive()
    const count = Number.isInteger(maxNodes) ? Math.max(1, Math.min(maxNodes, 500)) : 500
    const depth = Number.isInteger(maxDepth) ? Math.max(0, Math.min(maxDepth, 20)) : 20
    const result = traverseVueInstances(instance!, element, count, depth)
    assertActive()
    return result
  }

  /** Describe an active subtree without leaking Vue-owned objects. */
  function components(options: { rootId?: string, maxNodes?: number, maxDepth?: number } = {}) {
    let result = read(null, options.maxNodes, options.maxDepth)
    if (options.rootId) {
      const whole = read()
      const selected = whole.visits.find(value => id(value.instance) === options.rootId)
      if (!selected) throw Object.assign(new Error(whole.omittedCount ? 'CAPABILITY_UNAVAILABLE' : 'RUNTIME_CHANGED'), { code: whole.omittedCount ? 'CAPABILITY_UNAVAILABLE' : 'RUNTIME_CHANGED' })
      const count = Number.isInteger(options.maxNodes) ? Math.max(1, Math.min(options.maxNodes!, 500)) : 500
      const depth = Number.isInteger(options.maxDepth) ? Math.max(0, Math.min(options.maxDepth!, 20)) : 20
      result = traverseVueInstances(selected.instance, null, count, depth)
      assertActive()
    }
    const projection = { nodes: result.visits.map(value => node(value.instance, value.parent)), omittedCount: result.omittedCount, truncated: result.omittedCount > 0, coverage: 'partial' as const, limitations: result.limitations }
    while (new TextEncoder().encode(JSON.stringify(projection)).byteLength > 36 * 1024 && projection.nodes.length) {
      projection.nodes.pop()
      projection.omittedCount++
      projection.truncated = true
    }
    return projection
  }

  /** Resolve only selectors inside this captured app root. */
  function componentForElement(selector: string) {
    if (typeof selector !== 'string' || !selector || selector.length > 512) throw Object.assign(new Error('INVALID_SELECTOR'), { code: 'INVALID_SELECTOR' })
    let element: Element | null
    try {
      element = root.matches(selector) ? root : root.querySelector(selector)
    }
    catch { throw Object.assign(new Error('INVALID_SELECTOR'), { code: 'INVALID_SELECTOR' }) }
    const result = read(element)
    // An omitted branch may contain a deeper owner, so never claim an ancestor.
    const owner = result.omittedCount ? undefined : result.visits.findLast(value => value.ownsElement)
    return { matched: Boolean(element), node: owner ? node(owner.instance, owner.parent) : null, ...(element && !owner ? { unavailableReason: 'owner-unavailable' as const } : {}), coverage: 'partial' as const, limitations: result.limitations, truncated: result.omittedCount > 0 }
  }

  /** Resolve IDs only if their instance still appears in the current active tree. */
  function component(componentId: string) {
    const result = read()
    const owner = result.visits.find(value => id(value.instance) === componentId)
    if (!owner) throw Object.assign(new Error(result.omittedCount ? 'CAPABILITY_UNAVAILABLE' : 'RUNTIME_CHANGED'), { code: result.omittedCount ? 'CAPABILITY_UNAVAILABLE' : 'RUNTIME_CHANGED' })
    const props = projectVariantState(owner.instance.props as Record<string, unknown>)
    // setupState is a Vue runtime internal absent from its public instance type.
    const state = projectVariantState((owner.instance as ComponentInternalInstance & { setupState: Record<string, unknown> }).setupState)
    const data = projectVariantState(owner.instance.data as Record<string, unknown>)
    assertActive()
    const projection = { node: node(owner.instance, owner.parent), props: props.state, state: { ...data.state, ...state.state }, selectors: [] as string[], omittedValues: props.omittedValues + state.omittedValues + data.omittedValues, truncated: result.omittedCount > 0 || props.truncated || state.truncated || data.truncated, coverage: 'partial' as const, limitations: result.limitations }
    while (new TextEncoder().encode(JSON.stringify(projection)).byteLength > 36 * 1024) {
      const stateKey = Object.keys(projection.state).at(-1)
      const propKey = Object.keys(projection.props).at(-1)
      if (stateKey) delete projection.state[stateKey]
      else if (propKey) delete projection.props[propKey]
      else break
      projection.omittedValues++
      projection.truncated = true
    }
    return projection
  }

  /** Keep live elements within the runtime and refuse incomplete ownership evidence. */
  function resolveComponentElement(componentId: string): Element {
    const result = read()
    if (result.omittedCount) throw Object.assign(new Error('CAPABILITY_UNAVAILABLE'), { code: 'CAPABILITY_UNAVAILABLE' })
    const owner = result.visits.find(value => id(value.instance) === componentId)
    if (!owner) throw Object.assign(new Error('RUNTIME_CHANGED'), { code: 'RUNTIME_CHANGED' })
    const element = resolveVueComponentElement(owner.instance, root)
    assertActive()
    if (!element.isConnected || !root.contains(element)) throw Object.assign(new Error('RUNTIME_CHANGED'), { code: 'RUNTIME_CHANGED' })
    return element
  }

  return { components, componentForElement, component, resolveComponentElement, dispose: () => {
    disposed = true
  } }
}
