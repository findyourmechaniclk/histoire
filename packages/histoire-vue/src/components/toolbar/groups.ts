import type { ToolbarGroup } from '@histoire/plugin-kit'

/**
 * Native toolbar groups receiving plugin items, in toolbar order. Each has the same name as its
 * standalone workbench counterpart:
 * - `viewport`: after Viewport width, height, Rotate and Viewport preset.
 * - `background`: after Background and Checkerboard.
 * - `ui`: after Appearance (where it would be when the color scheme switch is hidden).
 * - `plugins`: trailing group after Open in editor.
 * Groups without a native counterpart (`search`, `tools`, `arrange`, `zoom`, `screenshot`,
 * `embed`, `inspector`) and unknown names fall back to `plugins`.
 */
export const NATIVE_TOOLBAR_GROUPS = ['viewport', 'background', 'ui', 'plugins'] as const satisfies readonly ToolbarGroup[]

/** Native toolbar group. */
export type NativeToolbarGroup = typeof NATIVE_TOOLBAR_GROUPS[number]

/**
 * Native group rendering items of `group`.
 * @param group Contribution group.
 */
export function nativeToolbarGroup(group: string): NativeToolbarGroup {
  return (NATIVE_TOOLBAR_GROUPS as readonly string[]).includes(group) ? group as NativeToolbarGroup : 'plugins'
}
