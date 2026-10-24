// Toolbar items, commands, shortcuts and menus: action contributions without views.
import type { ContributionView, WorkbenchContext, WorkbenchPluginApi } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../domain/model.js'

/**
 * Registers action contributions. The settings popover view is passed in because it is the
 * only view-bearing toolbar item.
 * @param api Plugin API.
 * @param model Plugin state.
 * @param settings Settings view of the UI variant, reused as popover body.
 */
export function registerActions(api: WorkbenchPluginApi, model: ReferenceModel, settings: ContributionView<WorkbenchContext>): void {
  const { audits, preferences } = model
  const toggleBadges = () => preferences.setBadges(!preferences.badges())

  api.toolbar.addItem({ id: 'run', group: 'plugins', type: 'action', label: 'Run audit', icon: 'renew', run: () => audits.rerun() })
  api.toolbar.addItem({ id: 'badges', group: 'plugins', type: 'toggle', label: 'Issue badges', icon: 'warning-alt', command: 'reference:toggle-badges', pressed: () => preferences.badges(), run: toggleBadges })
  api.toolbar.addItem({ id: 'quick-settings', group: 'plugins', type: 'popover', label: 'Audit settings', icon: 'settings-adjust', ...settings })

  api.commands.add({ id: 'toggle-badges', label: 'Toggle issue badges', icon: 'warning-alt', searchText: 'audit', run: toggleBadges })
  api.commands.add({ id: 'clear-annotations', label: 'Clear annotations', icon: 'erase', searchText: 'audit', run: () => preferences.clearAnnotations() })
  api.shortcuts.add({ id: 'toggle-badges-keys', command: 'reference:toggle-badges', keys: ['alt+shift+b'], scope: 'global' })

  api.menus.addFrameAction({
    id: 'frame-audit',
    label: 'Audit',
    icon: 'list-checked',
    // Runs against the right-clicked frame, never the selection.
    run: context => audits.rerun(context.frame.key),
    children: [
      { id: 'rerun', label: 'Audit again', icon: 'renew', run: context => audits.rerun(context.frame.key) },
      {
        id: 'copy',
        label: 'Copy report',
        icon: 'copy',
        async run(context) {
          const report = audits.get(context.frame.key)?.report
          if (!report) throw new Error('This frame has no audit yet')
          await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
        },
      },
    ],
  })
  api.menus.addContextAction({
    id: 'compare-story',
    targets: ['story'],
    label: 'Compare variants',
    icon: 'compare',
    // `available` hides the entry for targets without a story.
    available: context => Boolean(context.target.selection),
    async run(context) {
      // Selecting first: a story may restore its own remembered arrangement. The action's signal
      // follows the selection, so it aborts here by design and is not checked.
      await context.navigation.selectStory({ storyId: context.target.selection!.storyId })
      context.navigation.openCanvasView('reference:compare')
    },
  })
}
