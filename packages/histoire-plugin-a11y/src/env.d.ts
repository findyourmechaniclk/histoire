declare module 'virtual:histoire-a11y-axe' {
  /** Private engine instance; never assigned to story-owned window.axe. */
  const axe: typeof import('axe-core')
  export default axe
}
