import type { CanvasArrangement, CanvasDefaultArrangement, CanvasViewRegistry } from '../stores/canvas-arrangement.js'
import type { StoryCanvasViews } from '../stores/story-canvas-views.js'
import { computed } from 'vue'
import { isCanvasArrangement } from '../stores/canvas-arrangement.js'

/**
 * Preserve story layout defaults on legacy URLs, with explicit URL overrides first. Plugin views
 * pass while registered or pending in `canvasViews`; missing ones fall through like unknown values.
 */
export function resolveWorkbenchArrangement(query: unknown, storyLayout: unknown, localDefault?: CanvasDefaultArrangement, projectDefault?: CanvasDefaultArrangement, layoutExplicit = false, canvasViews?: CanvasViewRegistry): CanvasArrangement {
  if (isCanvasArrangement(query, canvasViews)) return query
  if (storyLayout === 'single' && layoutExplicit) return 'single'
  if (storyLayout === 'grid' || storyLayout === 'list') return storyLayout
  return localDefault ?? projectDefault ?? 'grid'
}

/** Resolve route, story memory, and existing defaults for one workbench. */
export function createWorkbenchArrangement(options: {
  /** Current query override candidate. */
  query: () => unknown
  /** Current story identity. */
  storyId: () => string | undefined
  /** Story-declared default arrangement. */
  storyLayout: () => unknown
  /** Explicit declaration before collection fallback; absent on older sources. */
  layoutExplicit?: () => boolean | undefined
  /** Local user default. */
  localDefault: () => CanvasDefaultArrangement | undefined
  /** Project default. */
  projectDefault: () => CanvasDefaultArrangement | undefined
  /** Current cross-story view mode. */
  syncZoom: () => boolean
  /** Workbench-scoped in-memory view snapshots. */
  views: StoryCanvasViews
  /** Plugin canvas views; reads must be reactive so registry changes re-resolve the arrangement. */
  canvasViews?: CanvasViewRegistry
}) {
  const base = computed(() => resolveWorkbenchArrangement(undefined, options.storyLayout(), options.localDefault(), options.projectDefault(), options.layoutExplicit?.() === true))
  const override = computed(() => isCanvasArrangement(options.query(), options.canvasViews))
  const arrangement = computed(() => {
    const query = options.query()
    if (isCanvasArrangement(query, options.canvasViews)) return query
    const storyId = options.storyId()
    const saved = options.syncZoom() ? options.views.getShared() : storyId ? options.views.getStory(storyId) : undefined
    // A remembered plugin view that is gone falls back like an unknown route value.
    return saved && isCanvasArrangement(saved.arrangement, options.canvasViews) ? saved.arrangement : base.value
  })
  return { arrangement, base, override }
}
