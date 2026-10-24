import { histoireIconNames } from '@histoire/shared/dist/icons/index.js'

/** Glyph shown in place of an icon name missing from the bundled offline set. */
export const FALLBACK_CONTRIBUTION_ICON = 'plug'

/** Bundled offline Carbon glyph names (`histoire-shared/src/icons/icon-names.json`). */
const ICON_NAMES = new Set(histoireIconNames)

/** Contributions already warned about, so a re-rendered surface warns once. */
const warned = new WeakSet<object>()

/**
 * Icon a surface renders for one contribution. Plugin icons must be bundled glyph names:
 * the workbench never fetches remote icons. Unknown names fall back to a generic glyph
 * with one warning per contribution.
 * @param contribution Qualified contribution carrying the plugin-provided icon name.
 * @param contribution.id Qualified id, named in the warning.
 * @param contribution.icon Plugin-provided icon name.
 */
export function resolveContributionIcon(contribution: { id: string, icon: unknown }): string {
  const { icon } = contribution
  if (typeof icon === 'string' && ICON_NAMES.has(icon)) return icon
  if (!warned.has(contribution)) {
    warned.add(contribution)
    console.warn(`[histoire] contribution "${contribution.id}" uses unknown icon ${JSON.stringify(icon)}; showing "${FALLBACK_CONTRIBUTION_ICON}". Use a glyph name from Histoire's bundled icon set.`)
  }
  return FALLBACK_CONTRIBUTION_ICON
}
