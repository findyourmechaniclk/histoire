/** Source-owned opt-in instrumentation policy, separate from agent exposure. */
export interface HistoireInspectionConfig {
  /** Enable generic live inspection. Defaults false. */
  enabled?: boolean
  /** Allow explicitly subscribed runtime diagnostics. Defaults false. */
  diagnostics?: boolean
  /** Enable available framework component providers. Defaults false. */
  components?: boolean
  /** Enable optional axe scanner. Defaults false. */
  accessibility?: boolean
  /** Additional exact origins, intersected with embed allowlist. Defaults empty. */
  allowedOrigins?: string[]
}
