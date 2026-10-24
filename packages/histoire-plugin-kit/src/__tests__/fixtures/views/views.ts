/** React and Vue fixture views; same behavior as the Svelte ones (see ./probe.ts). */
import type { ReactViewProps } from '../../../react/index.js'
import { createElement, Fragment, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { defineComponent, h, onMounted, onUnmounted, ref, Teleport } from 'vue'
import { useViewHost, useWorkbenchContext } from '../../../vue/index.js'
import { attachProbe } from './probe.js'

/** Context fields the fixtures read. */
interface Tagged { tag: string }

/**
 * React fixture view: portal through `createPortal`.
 * @param props View props.
 * @param props.context Tagged context.
 * @param props.host View host.
 */
export function ReactView({ context, host }: ReactViewProps<Tagged>) {
  const [clicks, setClicks] = useState(0)
  useEffect(() => attachProbe(host, false), [host])
  return createElement(
    Fragment,
    null,
    createElement('button', { onClick: () => setClicks(value => value + 1) }, `${context.tag}:${clicks}`),
    createPortal(createElement('div', null, 'portal'), host.overlayRoot),
  )
}

/** Vue fixture view: reads context through `useWorkbenchContext`, portal through `Teleport`. */
export const VueView = defineComponent({
  setup() {
    const context = useWorkbenchContext() as unknown as Tagged
    const host = useViewHost()
    const clicks = ref(0)
    let detach: (() => void) | undefined
    onMounted(() => {
      detach = attachProbe(host, false)
    })
    onUnmounted(() => detach?.())
    return () => [
      h('button', { onClick: () => clicks.value++ }, `${context.tag}:${clicks.value}`),
      h(Teleport, { to: host.overlayRoot }, h('div', 'portal')),
    ]
  },
})
