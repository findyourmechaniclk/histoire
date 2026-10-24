/** Sort key of one registered contribution. */
export interface ContributionRank {
  /** Built-ins always precede plugin entries. */
  readonly builtin: boolean
  /** Contribution `order`; `0` when omitted. */
  readonly order: number
  /** Plugin position in config; `-1` for built-ins. */
  readonly configIndex: number
  /** Host-wide registration sequence number. */
  readonly sequence: number
}

/**
 * Orders contributions: built-ins first (by their own `order`, then registration order),
 * then plugin entries by `order`, config order and registration order.
 * Commit time never matters, so a slow plugin keeps its config position.
 * @param a First rank.
 * @param b Second rank.
 */
export function compareRanks(a: ContributionRank, b: ContributionRank): number {
  if (a.builtin !== b.builtin) return a.builtin ? -1 : 1
  return a.order - b.order || a.configIndex - b.configIndex || a.sequence - b.sequence
}
