import type { CanvasArrangement } from './canvas-arrangement.js'
import type { CanvasPreferences, CanvasStorage, CanvasTool, CanvasZoom, CanvasZoomByArrange } from './canvas-types.js'
import { BUILTIN_NAMESPACE, parseQualifiedId } from '@histoire/plugin-kit'
import { clampZoom } from '../components/canvas/pan/usePanZoom.js'
import { isPluginContributionId } from '../extensions/shell-registry.js'
import { BUILTIN_CANVAS_ARRANGEMENTS } from './canvas-arrangement.js'

/**
 * Converts a persisted tool into a supported one. Unknown values become Select; a well-formed
 * plugin tool id is kept and checked against the registry once plugins settled.
 */
export function readCanvasTool(saved: { tool?: unknown, measure?: unknown }): CanvasTool {
  // Legacy measurement could coexist with Pan; preserve its intent as the exclusive tool.
  if (saved.tool === 'measure' || saved.measure === true) return 'measure'
  if (saved.tool === 'pan') return 'pan'
  const plugin = typeof saved.tool === 'string' ? parseQualifiedId(saved.tool) : null
  return plugin && plugin.namespace !== BUILTIN_NAMESPACE ? saved.tool as CanvasTool : 'select'
}

/** Converts persisted input into a supported canvas zoom preference. */
function readZoom(value: unknown, arrangement?: CanvasArrangement): CanvasZoom | undefined {
  if (value === 'fit') return value
  if (value === 'selection' && arrangement === 'list') return value
  return typeof value === 'number' && Number.isFinite(value) ? clampZoom(value) : undefined
}

/**
 * Zoom preference of one arrangement; plugin views not visited yet open at Fit.
 * @param zoomByArrange Remembered zoom preferences.
 * @param arrangement Active arrangement.
 */
export function arrangementZoom(zoomByArrange: CanvasZoomByArrange, arrangement: CanvasArrangement): CanvasZoom {
  return zoomByArrange[arrangement] ?? 'fit'
}

/** Keeps remembered plugin view zooms with well-formed ids and numeric or Fit values. */
function readPluginZooms(saved: Record<string, unknown>): Partial<CanvasZoomByArrange> {
  return Object.fromEntries(Object.entries(saved).flatMap(([key, value]) => {
    const zoom = isPluginContributionId(key) ? readZoom(value, key) : undefined
    return zoom === undefined ? [] : [[key, zoom]]
  }))
}

/** Creates independent default zoom preferences rather than sharing mutable state. */
function defaultZoomByArrange(): CanvasZoomByArrange {
  return { single: 'fit', grid: 'fit', list: 'selection', matrix: 'fit' }
}

/** Storage getter itself may throw in sandboxed or private browsing contexts. */
export function getCanvasStorage(window?: Pick<Window, 'localStorage'>): CanvasStorage | undefined {
  try {
    return window?.localStorage
  }
  catch { return undefined }
}

/** Validate saved values without trusting obsolete or corrupt local preferences. */
export function readCanvasPreferences(storage?: CanvasStorage): CanvasPreferences {
  const defaults: CanvasPreferences = { zoomByArrange: defaultZoomByArrange(), tool: 'select', frameBackground: 'transparent', autoFitContent: false }
  try {
    const saved = JSON.parse(storage?.getItem('_histoire-ui-canvas') ?? 'null')
    if (!saved || typeof saved !== 'object') return defaults
    const tool = readCanvasTool(saved)
    // Legacy books saved one zoom. Fan it out so every arrangement opens at the familiar scale.
    const legacyZoom = readZoom(saved.zoom)
    const savedZooms = saved.zoomByArrange && typeof saved.zoomByArrange === 'object' ? saved.zoomByArrange : {}
    const zoomByArrange = Object.fromEntries(BUILTIN_CANVAS_ARRANGEMENTS.map((arrangement) => {
      // Single zoom was forced to 100% before version 3, so old values carry no user intent.
      if (arrangement === 'single') return [arrangement, saved.version === 3 ? readZoom(savedZooms.single, arrangement) ?? 'fit' : 'fit']
      let zoom = readZoom(savedZooms[arrangement], arrangement) ?? legacyZoom ?? defaults.zoomByArrange[arrangement]
      // Old List Fit was the default; version 2 distinguishes a new explicit canvas Fit.
      if (arrangement === 'list' && zoom === 'fit' && saved.version !== 2 && saved.version !== 3) zoom = 'selection'
      return [arrangement, zoom]
    })) as CanvasZoomByArrange
    Object.assign(zoomByArrange, readPluginZooms(savedZooms))
    return { zoomByArrange, tool, frameBackground: typeof saved.frameBackground === 'string' ? saved.frameBackground : defaults.frameBackground, autoFitContent: saved.autoFitContent === true }
  }
  catch { return defaults }
}

/** Persist only user intent; measured geometry remains workbench-local. */
export function saveCanvasPreferences(storage: CanvasStorage | undefined, state: CanvasPreferences): void {
  try {
    storage?.setItem('_histoire-ui-canvas', JSON.stringify({ version: 3, zoomByArrange: state.zoomByArrange, tool: state.tool === 'comment' ? 'select' : state.tool, frameBackground: state.frameBackground, autoFitContent: state.autoFitContent }))
  }
  catch { /* Private browsing storage can be unavailable. */ }
}
