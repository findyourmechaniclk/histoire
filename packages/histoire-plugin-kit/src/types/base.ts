/** Fields shared by every contribution, parameterized by the surface context. */
export interface ContributionBase<C> {
  /** Local id, unique within the plugin; the host qualifies it as `${pluginId}:${id}`. */
  id: string
  /** Sort key among plugin entries of the same placement; lower first. */
  order?: number
  /** Re-evaluated on context changes; hidden while it returns `false`. */
  available?: (context: C) => boolean
  /** Omitted from static builds. */
  devOnly?: boolean
}
