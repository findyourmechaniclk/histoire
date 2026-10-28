import type { HistoireCapability, HistoireJsonValue } from './common.js'
import type { HistoireAccessibilityInspection } from './inspection-accessibility.js'
import type { HistoireComponentElementInspection, HistoireComponentInspection, HistoireComponentTreeInspection } from './inspection-components.js'
import type { HistoireReadonly } from './readonly.js'

/** Finite operations independent of transport or UI framework. */
export const HISTOIRE_INSPECTION_KINDS = ['variant', 'dom', 'components', 'component', 'componentForElement', 'accessibility', 'highlight', 'pick', 'highlightLease', 'highlightClear'] as const
/** A runtime inspection operation. */
export type HistoireInspectionKind = typeof HISTOIRE_INSPECTION_KINDS[number]
/** Independently advertised feature support; absent means unavailable. */
export type HistoireInspectionCapabilities = Partial<Record<'variant' | 'dom' | 'components' | 'componentDetails' | 'accessibilityAudit' | 'highlight' | 'componentHighlight' | 'pick' | 'highlightLease' | 'diagnostics', HistoireCapability>>
/** Captured source, document and rendered variant. IDs confer no authority. */
export interface HistoireInspectionOwner {
  /** Book identity. */
  sourceId: string
  /** Source lifetime. */
  epoch: string
  /** Completed source publication. */
  revision: string
  /** Exact mounted document lifetime. */
  runtimeId: string
  /** Exact rendered variant. */
  target: { storyId: string, variantId: string }
}
/** Local cancellation and optional exact ownership precondition. */
export interface HistoireInspectionOptions {
  /** Defaults to synchronously captured selected variant. */
  target?: HistoireInspectionOwner['target']
  /** Reject replacement rather than reading a successor. */
  expectedOwner?: HistoireInspectionOwner
  /** Trace label, never authority or deduplication. */
  correlationId?: string
  /** Local cancellation; never serialized. */
  signal?: AbortSignal
}
/** Bounded DOM query; first CSS match is inspected. */
export interface HistoireDomInspectionOptions extends HistoireInspectionOptions {
  /** Root selector, defaults to exact rendered variant root. */
  selector?: string
  /** Maximum retained elements, default 200, maximum 500. */
  maxNodes?: number
  /** Maximum depth, default 8, maximum 20. */
  maxDepth?: number
}
/** Common captured result metadata. */
export interface HistoireInspectionMetadata {
  /** Existing user document or fresh browser execution. */
  mode: 'live' | 'isolated'
  /** Captured source and runtime. */
  owner: HistoireInspectionOwner
  /** UTC observation timestamp. */
  observedAt: string
  /** Observation duration, not an atomic snapshot guarantee. */
  durationMs: number
  /** Work or serialized-size limits omitted content. */
  truncated: boolean
}
/** Descriptive prop metadata; factories/getters are never invoked. */
export interface HistoireInspectedProp {
  /** Prop label. */
  name: string
  /** Framework type labels. */
  types?: string[]
  /** Whether prop is required. */
  required?: boolean
  /** Descriptive default. */
  default?: HistoireJsonValue
  /** Current projected value. */
  value?: HistoireJsonValue
  /** Finite allowed values. */
  values?: HistoireJsonValue[]
}
/** Detached safe state and automatic prop definitions. */
export interface HistoireVariantProjection {
  /** Projected canonical state without runtime fields. */
  state: Record<string, HistoireJsonValue>
  /** Automatic metadata available, distinct from empty list. */
  propsAvailable: boolean
  /** Automatic prop groups, not component-instance tree. */
  components: { name: string, index: number, props: HistoireInspectedProp[] }[]
  /** Unsupported or clipped values. */
  omittedValues: number
  /** Work or byte limit reached. */
  truncated: boolean
}
/** Rendered element projection without input values or executable attributes. */
export interface HistoireInspectedElement {
  /** Snapshot-local index. */
  index: number
  /** Snapshot-local parent; null for root. */
  parentIndex: number | null
  /** Lowercase local tag name. */
  tag: string
  /** Allowlisted descriptive attributes. */
  attributes: Record<string, string>
  /** Bounded direct text. */
  text: string
  /** CSS viewport geometry. */
  rect: { x: number, y: number, width: number, height: number }
  /** Selected computed styles. */
  styles: Record<string, string>
}
/** Detached element subtree. */
export interface HistoireDomProjection {
  /** Root matched CSS query. */
  matched: boolean
  /** Retained preorder elements. */
  nodes: HistoireInspectedElement[]
  /** Traversal or output limit reached. */
  truncated: boolean
}
/** Variant inspection with ownership. */
export type HistoireVariantInspection = HistoireInspectionMetadata & HistoireVariantProjection & { inspection: 'variant' }
/** DOM inspection with ownership. */
export type HistoireDomInspection = HistoireInspectionMetadata & HistoireDomProjection & { inspection: 'dom' }
/** Public initial read results. Extension DTOs remain separately discriminated. */
export type HistoireInspectionResult = HistoireVariantInspection | HistoireDomInspection | HistoireComponentInspection | HistoireComponentTreeInspection | HistoireComponentElementInspection | HistoireAccessibilityInspection | (HistoireInspectionMetadata & import('./debug.js').HistoireDebugPage & { inspection: 'debug' })
/** Point hit within the exact captured story root. */
export type HistoireInspectionPick = { owner: HistoireInspectionOwner, observedAt: string } & ({ matched: true, selector: string } | { matched: false, selector?: never })
/** Opaque overlay lease, valid only for the captured private bridge owner. */
export interface HistoireHighlightLease {
  /** Captured public source and document identity. */
  owner: HistoireInspectionOwner
  /** UTC creation time. */
  observedAt: string
  /** Exact lease identity; does not independently grant authority. */
  leaseId: string
}
/** Result of clearing one exact overlay lease. */
export interface HistoireHighlightClear {
  /** Captured public source and document identity. */
  owner: HistoireInspectionOwner
  /** Whether this request removed the matching active overlay. */
  cleared: boolean
}
/** Browser-safe inspection API; never mounts a runtime. */
export interface HistoireInspection {
  /** Read getter-safe canonical runtime state. */
  variant: (options?: HistoireInspectionOptions) => Promise<HistoireReadonly<HistoireVariantInspection>>
  /** Inspect a bounded subtree of the current rendered document. */
  dom: (options?: HistoireDomInspectionOptions) => Promise<HistoireReadonly<HistoireDomInspection>>
  /** Bounded active framework instance tree. */
  components: (options?: HistoireInspectionOptions & { rootId?: string, maxNodes?: number, maxDepth?: number }) => Promise<HistoireReadonly<HistoireComponentTreeInspection>>
  /** Getter-safe details for exact instance. */
  component: (options: HistoireInspectionOptions & { componentId: string }) => Promise<HistoireReadonly<HistoireComponentInspection>>
  /** Find a proven framework owner for an element within the story root. */
  componentForElement: (options: HistoireInspectionOptions & { selector: string }) => Promise<HistoireReadonly<HistoireComponentElementInspection>>
  /** Explicit automated audit inside exact rendered variant. */
  accessibility: (options?: HistoireInspectionOptions & { selector?: string }) => Promise<HistoireReadonly<HistoireAccessibilityInspection>>
  /** Draw a temporary non-interactive ring in the exact runtime. */
  highlight: (options: HistoireInspectionOptions & { durationMs?: number } & ({ selector: string, componentId?: never } | { selector?: never, componentId: string })) => Promise<HistoireReadonly<{ owner: HistoireInspectionOwner, observedAt: string }>>
  /** Hit-test a CSS client point inside the captured runtime document. */
  pick: (options: HistoireInspectionOptions & { x: number, y: number }) => Promise<HistoireReadonly<HistoireInspectionPick>>
  /** Draw an overlay whose exact lease can be cleared later. */
  highlightLease: (options: HistoireInspectionOptions & { durationMs?: number } & ({ selector: string, componentId?: never } | { selector?: never, componentId: string })) => Promise<HistoireReadonly<HistoireHighlightLease>>
  /** Clear only the lease belonging to the captured target and owner. */
  clearHighlight: (options: HistoireInspectionOptions & { target: HistoireInspectionOwner['target'], expectedOwner: HistoireInspectionOwner, leaseId: string }) => Promise<HistoireReadonly<HistoireHighlightClear>>
}
