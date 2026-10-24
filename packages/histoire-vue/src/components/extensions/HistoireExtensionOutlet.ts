import type { ContributionKind, QualifiedContribution } from '@histoire/plugin-kit'
import type { PropType } from 'vue'
import { createContributionKeys } from '@histoire/plugin-kit'
import { defineComponent, h } from 'vue'
import { useHistoireContext } from '../../provider/context.js'
import { HistoireExtensionView } from './HistoireExtensionView.js'

/** Kinds whose views receive the selected variant's inspector context by default. */
const FRAME_SCOPED: readonly ContributionKind[] = ['inspector.tab', 'inspector.section']

/**
 * Renders the available contributions of one surface kind from the provider's extension host,
 * in registry order. Without `context`, inspector kinds use the selected variant's context and
 * every other kind the provider's root context. Renders nothing without a host, without a
 * context (no selected variant for inspector kinds) or for contributions unavailable there.
 */
export const HistoireExtensionOutlet = defineComponent({
  name: 'HistoireExtensionOutlet',
  props: {
    /** Contribution kind placed here. */
    kind: { type: String as PropType<ContributionKind>, required: true },
    /** Surface context; decides availability and is pushed to every view. */
    context: { type: Object, default: undefined },
    /** Narrows the placement, e.g. inspector sections of one tab and position. */
    filter: { type: Function as PropType<(contribution: QualifiedContribution) => boolean>, default: undefined },
  },
  setup(props) {
    const { extensions } = useHistoireContext()
    const keyOf = createContributionKeys()
    return () => {
      const context = props.context ?? (FRAME_SCOPED.includes(props.kind) ? extensions.frame : extensions.context)
      if (!context) return null
      const available = extensions.available(props.kind, context as never) as ReadonlyArray<QualifiedContribution>
      const placed = props.filter ? available.filter(props.filter) : available
      return placed.map(contribution => h(HistoireExtensionView, { key: keyOf(contribution), contribution, context }))
    }
  },
})
