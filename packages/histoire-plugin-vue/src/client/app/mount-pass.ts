import type { Story } from '@histoire/shared'
import type { App } from 'vue'
import { withStoryExecution } from '@histoire/shared'
import { h, reactive, render, Suspense } from 'vue'
import { PreviewHostRoot } from './host-root.js'

/** Story mount pass rendered inside an existing story app. */
export interface StoryMountPass {
  /** Resolves once the story and its async variant setups (`initState`) settled. */
  ready: Promise<void>
  /** Unmounts the pass and removes its element. */
  unmount: () => void
}

/**
 * Renders `story` in mount mode, like the hidden mount, but with `app`'s
 * context instead of a second app: plugins, provides and globals installed by
 * app setup (e.g. a Nuxt app and its plugins) are reused, so a story frame
 * runs app setup once. Variants register their config (`setupApp`,
 * `initState`, ...) on the story before the render pass sets up its variant.
 * @param app Story app, set up but not mounted yet
 * @param story Story whose variants get configured
 * @param parent Element receiving the hidden pass container
 */
export function mountStoryPass(app: App, story: Story, parent: HTMLElement): StoryMountPass {
  const el = document.createElement('div')
  el.style.display = 'none'
  parent.appendChild(el)
  const renderContext = reactive({
    mode: 'mount' as const,
    slotName: 'default',
    currentVariant: null,
    externalState: null,
    nextVariantIndex: { value: 0 },
  })
  let resolveReady: () => void
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  const root = h(PreviewHostRoot, { story, renderContext })
  // Rendered outside `app.mount`, the root component still resolves
  // components, provides and `getCurrentInstance().appContext.app` through the
  // app. Set on the component itself: `Suspense` has no instance to inherit from.
  root.appContext = (app as any)._context
  withStoryExecution(() => render(h(Suspense, { onResolve: () => resolveReady() }, root), el), el)
  return {
    ready,
    unmount() {
      render(null, el)
      el.remove()
    },
  }
}
