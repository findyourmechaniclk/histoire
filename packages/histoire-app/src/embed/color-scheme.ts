/**
 * Whether stories render dark with this color scheme setting.
 * @param colorScheme Runtime color scheme setting
 * @param view Window whose OS preference `auto` follows
 */
export function isColorSchemeDark(colorScheme: 'light' | 'dark' | 'auto', view: Window): boolean {
  return colorScheme === 'dark' || (colorScheme === 'auto' && !!view.matchMedia?.('(prefers-color-scheme: dark)').matches)
}
