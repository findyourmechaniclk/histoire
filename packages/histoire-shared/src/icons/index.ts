import brands from './brand-icons.json' with { type: 'json' }
import carbon from './carbon-icons.json' with { type: 'json' }

/** Literal offline glyph used by first-party browser components. */
export interface HistoireIconData {
  /** SVG body supplied by its icon collection. */
  body: string
  /** Coordinate width. */
  width?: number
  /** Coordinate height. */
  height?: number
}

/**
 * Original mdi:tailwind glyph from Material Design Icons (Apache-2.0).
 * Source and license details: tailwind-icon.NOTICE and carbon-icons.LICENSE.
 */
const tailwindLogo: HistoireIconData = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M12 6c-2.67 0-4.33 1.33-5 4c1-1.33 2.17-1.83 3.5-1.5c.76.19 1.31.74 1.91 1.35c.98 1 2.09 2.15 4.59 2.15c2.67 0 4.33-1.33 5-4c-1 1.33-2.17 1.83-3.5 1.5c-.76-.19-1.3-.74-1.91-1.35C15.61 7.15 14.5 6 12 6m-5 6c-2.67 0-4.33 1.33-5 4c1-1.33 2.17-1.83 3.5-1.5c.76.19 1.3.74 1.91 1.35C8.39 16.85 9.5 18 12 18c2.67 0 4.33-1.33 5-4c-1 1.33-2.17 1.83-3.5 1.5c-.76-.19-1.3-.74-1.91-1.35C10.61 13.15 9.5 12 7 12"/>',
}

/** Original puzzle glyph; see puzzle-icon.NOTICE. */
const puzzleIcon: HistoireIconData = {
  width: 24,
  height: 24,
  body: '<path d="M4 4h5.5a2.5 2.5 0 1 1 5 0H20v5.5a2.5 2.5 0 1 1 0 5V20h-5.5a2.5 2.5 0 1 0-5 0H4v-5.5a2.5 2.5 0 1 0 0-5V4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
}

/** Carbon subset shared with Iconify registration. */
export const histoireCarbonIcons = carbon
/** Approved glyph names shared by workbench and built-in controls. */
export const histoireIconNames = [...Object.keys(carbon.icons), ...Object.keys(brands), 'puzzle']

/** Resolve bundled glyph and logo names without making external requests. */
export function getHistoireIcon(name: string): HistoireIconData | undefined {
  if (name === 'mdi:tailwind') return { ...tailwindLogo }
  const resolved = name.replace(/^carbon:/, '')
  if (resolved === 'puzzle') return { ...puzzleIcon }
  if (Object.hasOwn(brands, resolved)) return { width: 24, height: 24, ...(brands as Record<string, HistoireIconData>)[resolved] }
  if (!Object.hasOwn(carbon.icons, resolved)) return
  const icon = (carbon.icons as Record<string, HistoireIconData>)[resolved]
  return { width: carbon.width, height: carbon.height, ...icon }
}
