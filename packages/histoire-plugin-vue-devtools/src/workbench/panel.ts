import type { FrameScopedContext, PluginFrameRef, PluginFrameWindow, ViewHost, WorkbenchPluginApi } from '@histoire/plugin-kit'
import { connectVueDevtools } from './relay.js'

/** Mount upstream Vue DevTools and retire its connection whenever frame ownership changes. */
export function mountVueDevtools(api: WorkbenchPluginApi, container: HTMLElement, initial: FrameScopedContext, host: ViewHost) {
  let context = initial
  let actor: PluginFrameRef | undefined
  let target: PluginFrameWindow | undefined
  let release: (() => void) | undefined

  /** Dispose the panel and its connection before changing owners. */
  function clear() {
    release?.()
    release = undefined
    actor = undefined
    target = undefined
    host.renderState(container, null)
    container.replaceChildren()
  }

  /** Reconcile the panel with the selected, attached actor. */
  function update() {
    const selected = context.selection.target
    const frame = context.frame
    const next = selected?.storyId === frame.target.storyId && selected.variantId === frame.target.variantId
      ? api.frames.list().find(item => item.key === frame.key && item.target.storyId === frame.target.storyId && item.target.variantId === frame.target.variantId)
      : undefined
    const window = next && api.frames.window(next)
    if (next && window && actor?.actorId === next.actorId && target?.documentId === window.documentId && target.window === window.window) return
    clear()
    if (next && !window) {
      host.renderState(container, { kind: 'empty', icon: 'code', title: 'Vue DevTools unavailable', detail: 'This host cannot connect to the story frame.' })
      return
    }
    if (!next || !window) {
      host.renderState(container, { kind: 'loading', title: 'Connecting Vue DevTools' })
      return
    }
    actor = next
    target = window
    const iframe = document.createElement('iframe')
    iframe.title = 'Vue DevTools'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.display = 'block'
    iframe.style.border = '0'
    iframe.src = new URL(`${import.meta.env.BASE_URL}__devtools__/`, document.baseURI).href
    release = connectVueDevtools(iframe, window, () => {
      const current = api.frames.window(next)
      const selected = context.selection.target
      return !host.signal.aborted && current?.documentId === window.documentId && current.window === window.window && selected?.storyId === frame.target.storyId && selected.variantId === frame.target.variantId
    })
    host.renderState(container, null)
    container.append(iframe)
  }

  const stopFrames = api.frames.subscribe(update)
  const stopContext = api.context.subscribe(update)
  update()
  return {
    update(next: FrameScopedContext) {
      context = next
      update()
    },
    dispose() {
      stopFrames()
      stopContext()
      clear()
    },
  }
}
