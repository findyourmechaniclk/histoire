import type { ComponentInternalInstance, VNode } from 'vue'

/** Internal traversal result remains inside the owning Vue adapter. */
export interface VueInspectionVisit {
  /** Live instance belonging to the captured Vue app. */
  instance: ComponentInternalInstance
  /** Parent instance retained in this traversal, if any. */
  parent: ComponentInternalInstance | null
  /** True when this instance owns the matched DOM node. */
  ownsElement: boolean
}

/** Framework marker reads must not invoke author-defined getters. */
function marker(value: unknown, name: string) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return false
  const descriptor = Object.getOwnPropertyDescriptor(value, name)
  return Boolean(descriptor && 'value' in descriptor && descriptor.value === true)
}

/** Walk only active VNodes with hard work limits; never inspect DOM expandos. */
export function traverseVueInstances(root: ComponentInternalInstance, element: Element | null, maxNodes: number, maxDepth: number) {
  const visits: VueInspectionVisit[] = []
  const seen = new Set<ComponentInternalInstance>()
  const limitations = new Set<'framework-metadata' | 'teleport' | 'async' | 'keep-alive'>(['framework-metadata'])
  let omittedCount = 0
  let work = 0

  /** Visit a mounted component and its active rendered subtree. */
  function component(instance: ComponentInternalInstance, parent: ComponentInternalInstance | null, depth: number) {
    if (!instance || instance.isUnmounted || seen.has(instance)) return
    if (visits.length >= maxNodes || depth > maxDepth || work >= 10000) {
      omittedCount++
      return
    }
    seen.add(instance)
    const visit: VueInspectionVisit = { instance, parent, ownsElement: false }
    visits.push(visit)
    vnode(instance.subTree, visit, depth, 0)
  }

  /** Traverse active children only; Teleport leaves the captured root. */
  function vnode(node: VNode | null, owner: VueInspectionVisit, depth: number, domDepth: number) {
    if (!node || ++work > 10000 || domDepth > 100) {
      if (work > 10000 || domDepth > 100) omittedCount++
      return
    }
    if (node.component) {
      if (marker(node.type, '__isKeepAlive')) limitations.add('keep-alive')
      component(node.component, owner.instance, depth + 1)
      return
    }
    if (node.suspense) {
      limitations.add('async')
      vnode(node.suspense.activeBranch, owner, depth, domDepth + 1)
      return
    }
    if (marker(node.type, '__isTeleport')) {
      limitations.add('teleport')
      return
    }
    // Only a VNode's exact element proves ownership; descendants may be
    // teleported or inserted outside Vue's rendering tree.
    if (element && node.el === element) owner.ownsElement = true
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (work >= 10000) {
          omittedCount++
          break
        }
        if (child && typeof child === 'object') vnode(child as VNode, owner, depth, domDepth + 1)
      }
    }
  }

  component(root, null, 0)
  return { visits, omittedCount, limitations: [...limitations] }
}
