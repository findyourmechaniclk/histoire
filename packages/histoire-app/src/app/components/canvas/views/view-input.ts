/** Marks the content root of a mounted custom view (set by `PluginCanvasView`). */
export const CANVAS_VIEW_CONTENT_ATTRIBUTE = 'data-histoire-canvas-view'

/**
 * Set by a view on its own elements (typically full-size backgrounds): a press whose target is
 * that element itself behaves like a press on empty canvas. Descendants stay view content, so a
 * background can hold interactive items without marking each one.
 */
export const CANVAS_PAN_AREA_ATTRIBUTE = 'data-histoire-canvas-pan'

/**
 * Whether a press on `target` belongs to custom view content, the way a press inside a story
 * frame belongs to the story: inside a view's content root, unless the target is a pan area.
 * @param target Pressed element.
 */
export function isCanvasViewContent(target: EventTarget | null): boolean {
  const element = target as Element | null
  if (!element?.closest?.(`[${CANVAS_VIEW_CONTENT_ATTRIBUTE}]`)) return false
  return !element.hasAttribute(CANVAS_PAN_AREA_ATTRIBUTE)
}
