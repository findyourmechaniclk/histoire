import type { ContributionPresence } from '../extensions/shell-registry.js'
import { isPluginContributionId } from '../extensions/shell-registry.js'

/** Arrangements shipped with the workbench, in switcher order. */
export const BUILTIN_CANVAS_ARRANGEMENTS = ['single', 'grid', 'list', 'matrix'] as const

/** Arrangement shipped with the workbench. */
export type BuiltinCanvasArrangement = typeof BUILTIN_CANVAS_ARRANGEMENTS[number]

/** Plugin canvas view, identified by its qualified contribution id (`<plugin>:<id>`). */
export type PluginCanvasArrangement = `${string}:${string}`

/** Canvas arrangement. Single source of truth for every view switch, route and preference. */
export type CanvasArrangement = BuiltinCanvasArrangement | PluginCanvasArrangement

/** Arrangement usable as a story, local or project default; Matrix is only entered explicitly. */
export type CanvasDefaultArrangement = Exclude<BuiltinCanvasArrangement, 'matrix'>

/** Registry view of plugin canvas views; see `createContributionLookup`. */
export interface CanvasViewRegistry {
  /** Presence of one candidate plugin view id. */
  presence: (id: unknown) => ContributionPresence
}

/**
 * Whether `value` names a built-in arrangement.
 * @param value Candidate route, preference or snapshot value.
 */
export function isBuiltinCanvasArrangement(value: unknown): value is BuiltinCanvasArrangement {
  return typeof value === 'string' && (BUILTIN_CANVAS_ARRANGEMENTS as readonly string[]).includes(value)
}

/**
 * Test whether a value (route query, remembered view, emitted switch) names an arrangement.
 * Every caller goes through this guard so registered views join in one place. A plugin view is
 * accepted while registered, and also while plugin setup is still pending, so deep links show
 * the view's loading state instead of falling back before `ready`.
 * @param value Candidate value.
 * @param views Plugin canvas view registry; without it plugin views are rejected.
 */
export function isCanvasArrangement(value: unknown, views?: CanvasViewRegistry): value is CanvasArrangement {
  if (isPluginContributionId(value)) return !!views && views.presence(value) !== 'missing'
  return isBuiltinCanvasArrangement(value)
}
