import type { ComponentInternalInstance, VNode } from 'vue'
import { Comment, Fragment, Text } from 'vue'

/** Resolve one proven rendered root without returning teleported or partial output. */
export function resolveVueComponentElement(instance: ComponentInternalInstance, root: Element): Element {
  const elements: Element[] = []
  let work = 0
  let unavailable = false

  /** Follow only active Vue roots; a fragment is safe only when it has one element. */
  function visit(node: VNode | null, depth: number): void {
    if (!node || unavailable) return
    if (++work > 10000 || depth > 100) {
      unavailable = true
      return
    }
    const marker = node.type && Object.getOwnPropertyDescriptor(node.type, '__isTeleport')
    if (marker && 'value' in marker && marker.value === true) {
      unavailable = true
      return
    }
    if (node.component) {
      if (node.component.isUnmounted || node.component.isDeactivated) {
        unavailable = true
        return
      }
      visit(node.component.subTree, depth + 1)
      return
    }
    if (node.suspense) {
      visit(node.suspense.activeBranch, depth + 1)
      return
    }
    if (node.type === Comment) return
    if (node.type === Text) {
      if (typeof node.children === 'string' && node.children.trim()) unavailable = true
      return
    }
    if (node.type === Fragment) {
      if (!Array.isArray(node.children)) {
        unavailable = true
        return
      }
      for (const child of node.children) {
        if (unavailable) break
        if (child && typeof child === 'object') visit(child as VNode, depth + 1)
        else if (typeof child === 'string' && child.trim()) unavailable = true
      }
      return
    }
    const element = node.el as Node | null
    if (!element || element.nodeType !== 1 || element.ownerDocument !== root.ownerDocument || !element.isConnected || !root.contains(element)) {
      unavailable = true
      return
    }
    elements.push(element as Element)
    if (elements.length > 1) unavailable = true
  }

  visit(instance.subTree, 0)
  if (unavailable || elements.length !== 1) throw Object.assign(new Error('CAPABILITY_UNAVAILABLE'), { code: 'CAPABILITY_UNAVAILABLE' })
  return elements[0]
}
