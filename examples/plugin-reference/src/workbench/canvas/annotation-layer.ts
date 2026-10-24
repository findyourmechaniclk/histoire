import type { CanvasScopedContext, MountView } from '@histoire/plugin-kit'
import type { AnnotationRect } from '../../domain/annotation-draft.js'
import type { ReferenceModel } from '../../domain/model.js'
import { h } from '../../dom/h.js'

/**
 * Absolutely positioned box in canvas units; the host's `canvas` layer applies pan and zoom.
 * @param rect Rectangle in canvas space.
 * @param draft Whether the rectangle is still being drawn.
 */
function box(rect: AnnotationRect, draft: boolean): HTMLElement {
  const element = h('div', { 'class': 'hst-ref-annotation', 'data-draft': draft })
  Object.assign(element.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  return element
}

/**
 * Passive `canvas`-space overlay showing saved annotations and the one being drawn. DOM view
 * shared by every UI variant: it only draws boxes, no framework needed.
 * @param model Plugin state.
 */
export function annotationLayer(model: ReferenceModel): MountView<CanvasScopedContext> {
  return {
    mount(container) {
      const render = () => {
        const draft = model.draft.get()
        container.replaceChildren(
          ...model.preferences.annotations().map(rect => box(rect, false)),
          ...draft ? [box(draft, true)] : [],
        )
      }
      const stops = [model.preferences.subscribe(render), model.draft.subscribe(render)]
      render()
      return { dispose: () => stops.forEach(stop => stop()) }
    },
  }
}
