import type { PluginFrameWindow } from '@histoire/plugin-kit'

/** Relay only the upstream Vue DevTools handshake between the panel and its selected actor. */
export function connectVueDevtools(panel: HTMLIFrameElement, frame: PluginFrameWindow, active: () => boolean): () => void {
  const owner = panel.ownerDocument.defaultView!
  let pending: string | undefined

  /** Forward same-origin handshakes only from the exact panel and selected frame windows. */
  function receive(event: MessageEvent) {
    const data = event.data
    if (!data || data.channel !== 'devframe:in-page-channel' || data.v !== 2 || data.name !== 'vue-devtools' || typeof data.panelId !== 'string') return
    if (event.source !== panel.contentWindow && event.source !== frame.window) return
    if (event.origin !== frame.origin || !active()) {
      if (data.kind === 'grant' && event.source === frame.window && data.panelId === pending) {
        for (const port of event.ports) port.close()
      }
      return
    }
    if (data.kind === 'hello' && event.source === panel.contentWindow) {
      pending = data.panelId
      frame.window.postMessage(data, frame.origin)
    }
    else if (data.kind === 'grant' && event.source === frame.window && pending === data.panelId) {
      pending = undefined
      const port = event.ports[0]
      if (port && panel.contentWindow) panel.contentWindow.postMessage(data, frame.origin, [port])
      else port?.close()
    }
  }

  owner.addEventListener('message', receive)
  return () => {
    owner.removeEventListener('message', receive)
    pending = undefined
    panel.remove()
  }
}
