import type { PropType, VNodeChild } from 'vue'
import { h } from 'vue'

/** Optional host classes keyed by a component's documented element names. */
export type HistoirePartClasses<Part extends string> = Partial<Record<Part, string>>

/** Typed optional prop shared by native render-function components. */
export function partClassesProp<Part extends string>() {
  return { type: Object as PropType<HistoirePartClasses<Part>>, default: undefined }
}

/** Keep package marker classes first and append caller utilities without dropping either. */
export function mergePartClass(defaultClass: string, customClass?: string): string {
  return customClass ? `${defaultClass} ${customClass}`.trim() : defaultClass
}

/** Opt-in state layout wrapper; default slot DOM stays unchanged without host classes. */
export function renderPartState(content: VNodeChild, className?: string): VNodeChild {
  return className ? h('div', { class: className }, [content]) : content
}
