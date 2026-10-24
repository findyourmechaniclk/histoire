import type { ServerRunPayload } from '@histoire/shared'
import type { Vue3StorySetupApi } from '../../helpers.js'
import { createApp, h } from 'vue'
import { createAppHooks } from '../app/app-hooks.js'
import { runSetupHooks } from '../app/setup-hooks.js'
import Story from './Story'
import Variant from './Variant'

/** Render a story file once in the collect worker to gather its stories and docs. */
export async function run({ file, storyData, el }: ServerRunPayload) {
  const { default: Comp } = await import(/* @vite-ignore */ file.moduleId)

  const app = createApp({
    provide: {
      addStory(data) {
        storyData.push(data)
      },
    },
    render() {
      return h(Comp, {
        ref: 'comp',
        data: file,
      })
    },
  })

  app.component('Story', Story)

  app.component('Variant', Variant)

  // Call app setups to resolve global assets such as components

  // Collection never runs mount stages, but setup code may still register
  // hooks and acquire resources released after unmount.
  const hooks = createAppHooks(app)
  const setupApi: Vue3StorySetupApi = {
    app,
    story: null,
    variant: null,
    addWrapper: () => { /* noop */ },
    hooks: hooks.api,
    // Collection has no appearance to follow.
    onDarkChange: () => { /* noop */ },
  }

  let failure: unknown
  try {
    await runSetupHooks(setupApi, hooks)

    app.mount(el)

    if (Comp.doc) {
      const el = document.createElement('div')
      el.innerHTML = Comp.doc
      const text = el.textContent
      storyData.forEach((s) => {
        s.docsText = text
      })
    }
  }
  catch (error) {
    failure = error ?? new Error('Story collection failed')
  }

  // Same order as the story host: release setup resources, then unmount,
  // even when setup or mount failed in the collect worker.
  let cleanupError: unknown
  try {
    hooks.close()
  }
  catch (error) {
    cleanupError = error
  }
  finally {
    if (app._container) app.unmount()
  }

  if (failure) {
    // Never hide the setup/mount failure behind a cleanup one.
    if (cleanupError) console.error(cleanupError)
    throw failure
  }
  if (cleanupError) throw cleanupError
}
