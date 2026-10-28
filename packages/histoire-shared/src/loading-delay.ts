/** Delay before showing a loading presentation. */
export const LOADING_DELAY_MS = 100

/** Controls one loading presentation without delaying its underlying operation. */
export interface LoadingDelay {
  /** Begin or end the current pending interval. */
  setPending: (pending: boolean) => void
  /** Cancel pending work and stop publishing changes. */
  dispose: () => void
}

/**
 * Shows loading only when a pending interval lasts at least 100 ms.
 * @param publish Receives visibility changes.
 */
export function createLoadingDelay(publish: (visible: boolean) => void): LoadingDelay {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false
  let visible = false
  let disposed = false

  return {
    setPending(next) {
      if (disposed || pending === next) return
      pending = next
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      if (next) {
        timer = setTimeout(() => {
          timer = undefined
          if (!disposed && pending) {
            visible = true
            publish(true)
          }
        }, LOADING_DELAY_MS)
      }
      else if (visible) {
        visible = false
        publish(false)
      }
    },
    dispose() {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    },
  }
}
