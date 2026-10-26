import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useOverflowToolbar } from './context.js'

/** Layout presentation of a persistent toolbar item. */
export type ToolbarPresentation = 'inline' | 'menu'

/** Read reactive item presentation; controls outside overflow default to inline. */
export function useToolbarPresentation(): ComputedRef<ToolbarPresentation> {
  const { overflow } = useOverflowToolbar()
  return computed(() => overflow?.value ? 'menu' : 'inline')
}
