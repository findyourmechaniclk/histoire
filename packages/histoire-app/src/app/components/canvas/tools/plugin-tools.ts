import type { CanvasScopedContext } from '@histoire/plugin-kit'
import type { ComputedRef, InjectionKey } from 'vue'
import type { WorkbenchHost } from '../../../extensions/create-workbench-host.js'
import type { CanvasStore, CanvasTool } from '../../../stores/canvas.js'
import type { createShortcutRegistry } from '../../../util/shortcuts.js'
import type { PluginCanvasTool } from './plugin-tool.js'
import { BUILTIN_NAMESPACE, parseQualifiedId } from '@histoire/plugin-kit'
import { computed, inject, onScopeDispose, provide, ref, watch } from 'vue'

/** Registry-backed plugin tools of one canvas viewport. */
export interface CanvasPluginTools {
  /** Available plugin tools in switcher order. */
  tools: ComputedRef<readonly PluginCanvasTool[]>
  /** Plugin tool currently selected, if any. */
  active: ComputedRef<PluginCanvasTool | undefined>
  /** Select a plugin tool. */
  activate: (tool: PluginCanvasTool) => void
  /** Record a tool failure and fall back to Select. */
  fail: (tool: PluginCanvasTool, error: unknown) => void
}

/** Inputs of the plugin tools of one viewport. */
export interface CanvasPluginToolsOptions {
  /** Workbench extension host; absent outside a workbench (native hosts, tests). */
  workbench: WorkbenchHost | undefined
  /** Canvas whose tool preference is read and corrected. */
  canvas: CanvasStore
  /** Canvas-scoped context deciding availability. */
  context: CanvasScopedContext | undefined
  /** Workbench shortcut registry receiving tool shortcuts. */
  shortcuts?: ReturnType<typeof createShortcutRegistry>
}

/** Whether a tool preference names a plugin tool. */
function isPluginTool(tool: string): boolean {
  const parsed = parseQualifiedId(tool)
  return !!parsed && parsed.namespace !== BUILTIN_NAMESPACE
}

/**
 * Track the viewport's plugin tools: list them for the tool switch, register their shortcuts
 * in the workbench registry (`canvas` scope) and keep the tool preference valid. A remembered
 * plugin tool survives until plugins settled; one that is missing then, or removed later,
 * falls back to Select.
 */
export function useCanvasPluginTools(options: CanvasPluginToolsOptions): CanvasPluginTools {
  const { workbench, canvas, context } = options
  // Registry snapshots are not reactive: a host notification bumps this revision.
  const revision = ref(0)
  const ready = ref(!workbench)
  if (workbench) {
    onScopeDispose(workbench.host.subscribe(() => revision.value++))
    void workbench.host.ready.then(() => ready.value = true)
  }
  const tools = computed<readonly PluginCanvasTool[]>(() => {
    void revision.value
    return workbench && context ? workbench.host.available('canvas.tool', context) : []
  })
  const active = computed(() => tools.value.find(tool => tool.id === canvas.tool))

  /** Select a plugin tool; registry ids are always qualified (`<plugin>:<id>`). */
  function activate(tool: PluginCanvasTool): void {
    canvas.setTool(tool.id as CanvasTool)
  }

  /** Report a failing tool to the host diagnostics and deactivate it. */
  function fail(tool: PluginCanvasTool, error: unknown): void {
    workbench?.host.reportViewError(tool.id, error, 'report')
    if (canvas.tool === tool.id) canvas.setTool('select')
  }

  watch([() => canvas.tool, tools, ready], () => {
    if (ready.value && isPluginTool(canvas.tool) && !active.value) canvas.setTool('select')
  }, { immediate: true, flush: 'sync' })

  // Shortcut registrations follow contribution objects; a re-registered tool re-binds.
  const bindings = new Map<PluginCanvasTool, () => void>()
  watch(tools, (current) => {
    for (const [tool, dispose] of bindings) {
      if (current.includes(tool)) continue
      dispose()
      bindings.delete(tool)
    }
    for (const tool of current) {
      if (bindings.has(tool) || !tool.shortcut?.length || !options.shortcuts) continue
      try {
        bindings.set(tool, options.shortcuts.register({ id: tool.id, label: tool.label, keys: tool.shortcut, scope: 'canvas', handler: () => activate(tool) }))
      }
      catch (error) {
        // Duplicate ids or bindings leave the tool usable from the switch.
        workbench?.host.reportViewError(tool.id, error, 'report')
        bindings.set(tool, () => {})
      }
    }
  }, { immediate: true })
  onScopeDispose(() => {
    for (const dispose of bindings.values()) dispose()
    bindings.clear()
  })

  return { tools, active, activate, fail }
}

const pluginToolsKey: InjectionKey<CanvasPluginTools> = Symbol('histoire-canvas-plugin-tools')

/** Provide the viewport's plugin tools to its tool switch and capture layer. */
export function provideCanvasPluginTools(tools: CanvasPluginTools): void {
  provide(pluginToolsKey, tools)
}

/** Plugin tools of the nearest viewport; absent in portable toolbars. */
export function injectCanvasPluginTools(): CanvasPluginTools | undefined {
  return inject(pluginToolsKey, undefined)
}
