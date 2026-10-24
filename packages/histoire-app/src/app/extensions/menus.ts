import type { ContextMenuContext, ContextMenuTarget, Disposer, FrameMenuChild, FrameRef, QualifiedContribution, WorkbenchContext } from '@histoire/plugin-kit'
import type { createContextMenu, WorkbenchContextTarget } from '../composables/context-menu.js'
import type { createFrameActions, FrameAction, FrameActionTarget } from '../util/frame-actions.js'
import type { WorkbenchHost } from './create-workbench-host.js'
import type { FrameSession } from './frame-context.js'
import { isContributionAvailable, syncContributions } from './sync.js'

/**
 * Runnable id of a frame-menu child: `${itemId}:${childId}` (`acme:export:json`). Local ids
 * never contain `:`, so it cannot collide with a contribution id; `ExtensionHost.run` resolves it
 * to the child action under the item's plugin scope.
 * @param itemId Qualified frame-menu item id.
 * @param childId Child id local to the item.
 */
export function frameMenuChildId(itemId: string, childId: string): string {
  return `${itemId}:${childId}`
}

/**
 * Frame identity exposed to plugins for a canvas frame target.
 * @param target Right-clicked frame.
 */
function toFrameRef(target: FrameActionTarget): FrameRef {
  return { key: target.frameKey, target: { storyId: target.storyId, variantId: target.variantId } }
}

/**
 * Registers plugin `frame-menu.item` contributions as frame actions. Actions and children run
 * against a frame scope bound to the right-clicked frame's own session, so they never follow or
 * change the selection; the scope is retired once the action settles. Failures reach the frame
 * action registry's error boundary.
 * @param workbench Workbench extension host.
 * @param actions Frame action registry of the same workbench.
 * @param frameSession Session owning a frame (frame session, or the canonical one).
 */
export function registerPluginFrameMenu(workbench: WorkbenchHost, actions: ReturnType<typeof createFrameActions>, frameSession: (target: FrameActionTarget) => FrameSession): Disposer {
  /**
   * Runs `fn` with a frame scope of `target`, retiring it afterwards.
   * @param target Frame target.
   * @param fn Consumer of the scope.
   */
  async function withFrameScope<T>(target: FrameActionTarget, fn: (scope: ReturnType<WorkbenchHost['frameScope']>) => T | Promise<T>): Promise<T> {
    const scope = workbench.frameScope(toFrameRef(target), frameSession(target))
    try {
      return await fn(scope)
    }
    finally { scope.retire() }
  }

  /**
   * Evaluates availability against a short-lived frame scope (predicates read the frame's runtime).
   * @param item Frame-menu contribution.
   * @param target Frame target.
   */
  function available(item: QualifiedContribution<'frame-menu.item'>, target: FrameActionTarget): boolean {
    const scope = workbench.frameScope(toFrameRef(target), frameSession(target))
    try {
      return isContributionAvailable(workbench, 'frame-menu.item', item, scope.context)
    }
    finally { scope.retire() }
  }

  /**
   * Frame action of one child entry.
   * @param item Owning contribution.
   * @param child Child entry.
   */
  function childAction(item: QualifiedContribution<'frame-menu.item'>, child: FrameMenuChild): FrameAction {
    const id = frameMenuChildId(item.id, child.id)
    return { id, label: child.label, icon: child.icon, group: child.group, run: target => withFrameScope(target, scope => workbench.run(id, scope)) }
  }

  return syncContributions(workbench, 'frame-menu.item', (item) => {
    const children = item.children?.map(child => childAction(item, child))
    return actions.registerFrameAction({
      id: item.id,
      label: item.label,
      icon: item.icon,
      // Plugin entries get their own separator group unless they join an existing one.
      group: item.group ?? item.pluginId,
      available: target => available(item, target),
      children: children && (() => children),
      run: target => withFrameScope(target, scope => workbench.run(item.id, scope)),
    })
  })
}

/**
 * Serializable target exposed to plugins; DOM references of control targets never leak.
 * @param target Captured workbench target.
 */
function toContextMenuTarget(target: WorkbenchContextTarget): ContextMenuTarget {
  const selection = 'selection' in target && target.selection
    ? Object.freeze({ storyId: target.selection.storyId, variantId: target.selection.variantId ?? null })
    : undefined
  const frame = 'frame' in target && target.frame ? toFrameRef(target.frame) : undefined
  return Object.freeze({
    kind: target.kind,
    label: target.label,
    ...('key' in target && target.key !== undefined ? { key: target.key } : {}),
    ...(selection ? { selection } : {}),
    ...(frame ? { frame: Object.freeze(frame) } : {}),
  })
}

/**
 * Root context extended with the captured target; getters keep reading the live root context.
 * @param context Root context.
 * @param target Captured target.
 */
function withTarget(context: WorkbenchContext, target: WorkbenchContextTarget): ContextMenuContext {
  return Object.freeze(Object.defineProperties({}, {
    ...Object.getOwnPropertyDescriptors(context),
    target: { value: toContextMenuTarget(target), enumerable: true },
  })) as ContextMenuContext
}

/**
 * Registers plugin `context-menu.item` contributions as global workbench context actions,
 * shown only on their declared target kinds. Actions run through the workbench action runner
 * with the captured target and the root scope current at invocation.
 * @param workbench Workbench extension host.
 * @param menu Context menu of the same workbench.
 */
export function registerPluginContextMenu(workbench: WorkbenchHost, menu: ReturnType<typeof createContextMenu>): Disposer {
  return syncContributions(workbench, 'context-menu.item', item => menu.register({
    id: item.id,
    label: item.label,
    icon: item.icon ?? '',
    group: item.pluginId,
    global: true,
    available: target => item.targets.includes(target.kind) && isContributionAvailable(workbench, 'context-menu.item', item, withTarget(workbench.context, target)),
    run(target) {
      const scope = workbench.rootScope()
      return workbench.run(item.id, { context: withTarget(scope.context, target), signal: scope.signal })
    },
  }))
}
