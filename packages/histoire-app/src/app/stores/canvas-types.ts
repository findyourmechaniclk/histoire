import type { CanvasFitOptions, CanvasPoint, CanvasRect } from '../components/canvas/pan/usePanZoom.js'
import type { BuiltinCanvasArrangement, CanvasArrangement, PluginCanvasArrangement } from './canvas-arrangement.js'

/** Pointer mode shipped with the workbench. `comment` exists only in dev with comments available and is never persisted. */
export type BuiltinCanvasTool = 'select' | 'pan' | 'measure' | 'comment'
/**
 * Persistent canvas pointer mode: a built-in tool or a registered plugin tool's qualified id
 * (`<plugin>:<id>`). Plugin ids are validated against the registry once plugins settled.
 */
export type CanvasTool = BuiltinCanvasTool | `${string}:${string}`
/** Logical scale, whole-canvas fit, or List selection fitting. */
export type CanvasZoom = number | 'fit' | 'selection'

/** Frame bounds can resolve fixed-pixel labels at each candidate scale. */
export type CanvasFitTarget = CanvasRect | ((zoom: number) => CanvasRect)

/**
 * Locally persisted zoom preference for every built-in arrangement, plus plugin views visited
 * so far; a plugin view without an entry opens at Fit (see `arrangementZoom`).
 */
export type CanvasZoomByArrange = Record<BuiltinCanvasArrangement, CanvasZoom> & Partial<Record<PluginCanvasArrangement, CanvasZoom>>

/** Session-owned view state saved separately for each story. */
export interface CanvasViewSnapshot {
  /** Requested arrangement, before any temporary Matrix fallback. */
  arrangement: CanvasArrangement
  /** Independent zoom preference for each arrangement. */
  zoomByArrange: CanvasZoomByArrange
  /** Canvas translation in viewport CSS pixels. */
  panOffset: CanvasPoint
}

/** Persistent canvas preferences; per-story transforms use workbench memory. */
export interface CanvasPreferences {
  /** Fit each runtime's intrinsic content rather than a shared viewport. */
  autoFitContent: boolean
  /** Independent zoom preference for each arrangement. */
  zoomByArrange: CanvasZoomByArrange
  /** Persistent pointer mode. */
  tool: CanvasTool
  /** Frame-only CSS background. */
  frameBackground: string
}

/** Optional local-storage port avoids shared mutable state and browser-only imports. */
export interface CanvasStorage {
  /** Read saved preference JSON. */
  getItem: (key: string) => string | null
  /** Write saved preference JSON. */
  setItem: (key: string, value: string) => void
}

/** Fixed canvas chrome belongs to layout geometry, never saved user preferences. */
export type CanvasContentInsets = Pick<CanvasFitOptions, 'topInset' | 'bottomInset'>
