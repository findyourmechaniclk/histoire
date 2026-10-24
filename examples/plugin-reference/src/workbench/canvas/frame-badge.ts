import type { FrameScopedContext, MountView } from '@histoire/plugin-kit'
import type { ReferenceModel } from '../../domain/model.js'
import { h } from '../../dom/h.js'
import { issueCount } from '../../domain/format.js'

/**
 * Passive per-frame overlay: issue count in the frame's corner. One instance per rendered frame;
 * `context.frame.key` identifies it (two frames of one variant get two badges).
 * @param model Plugin state.
 */
export function frameBadge(model: ReferenceModel): MountView<FrameScopedContext> {
  return {
    mount(container, initial) {
      let context = initial
      const render = () => {
        const report = model.audits.get(context.frame.key)?.report
        const count = report?.issues.length ?? 0
        container.replaceChildren(...model.preferences.badges() && count
          ? [h('span', { 'class': 'hst-ref-chip hst-ref-frame-badge', 'data-tone': 'warn' }, issueCount(count))]
          : [])
      }
      const stops = [model.audits.subscribe(render), model.preferences.subscribe(render)]
      render()
      return {
        update(next) {
          context = next
          render()
        },
        dispose: () => stops.forEach(stop => stop()),
      }
    },
  }
}
