import type { QualifiedContribution, WorkbenchContext } from '@histoire/plugin-kit'
import type { PluginShellPane, ShellPane } from '../../stores/shell.js'
import { resolveContributionIcon } from '../../extensions/icons.js'

/** Badge color semantics: failures, agent activity, an agent waiting for the user, or plugin status. */
export type RailBadgeTone = 'danger' | 'agent' | 'attention' | 'accent'

/** One finite descriptor drives rail labeling, iconography, and mode filtering. */
export interface RailItem {
  /** Persisted local pane identity. */
  id: ShellPane
  /** Accessible action label. */
  label: string
  /** Bundled Carbon icon without collection prefix. */
  icon: string
  /** Capability absent from static books. */
  devOnly?: boolean
  /** Status color semantics from tests or connected agent services. */
  badgeTone?: RailBadgeTone
  /** Plugin pane backing this destination. */
  contribution?: QualifiedContribution<'shell.pane'>
}

/** Home navigation remains standalone-owned; other entries change local panels. */
export const railItems: readonly RailItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'stories', label: 'Stories', icon: 'catalog' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'tests', label: 'Tests', icon: 'chemistry', devOnly: true, badgeTone: 'danger' },
  { id: 'ai', label: 'AI', icon: 'bot', devOnly: true, badgeTone: 'agent' },
]

/**
 * Rail destination of one plugin pane, appended after built-ins.
 * @param pane Available plugin pane.
 */
export function toPluginRailItem(pane: QualifiedContribution<'shell.pane'>): RailItem {
  return { id: pane.id as PluginShellPane, label: pane.label, icon: resolveContributionIcon(pane), badgeTone: 'accent', contribution: pane }
}

/** Plugin panes whose badge failure was already reported; rails re-evaluate badges often. */
const failedBadges = new WeakSet<object>()

/**
 * Badge of a plugin destination. Empty values hide it; a throwing callback hides it and is
 * reported once, so a broken badge never breaks the rail.
 * @param item Rail destination.
 * @param context Root workbench context.
 * @param report Records the failure against the contribution.
 */
export function getPluginRailBadge(item: RailItem, context: WorkbenchContext, report: (error: unknown) => void): number | string | undefined {
  try {
    const value = item.contribution?.badge?.(context)
    return value === null || value === '' || value === 0 ? undefined : value
  }
  catch (error) {
    if (item.contribution && !failedBadges.has(item.contribution)) {
      failedBadges.add(item.contribution)
      report(error)
    }
    return undefined
  }
}
