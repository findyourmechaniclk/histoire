import type { Vue3StorySetupApi, Vue3StorySetupHandler } from '../../helpers.js'
import type { Vue3AppHooks } from './app-hooks.js'
import { withStoryExecution } from '@histoire/shared'
// @ts-expect-error virtual module id
import * as generatedSetup from 'virtual:$histoire-generated-global-setup'
// @ts-expect-error virtual module id
import * as setup from 'virtual:$histoire-setup'

/**
 * Run plugin-generated, user and variant setup functions in order. The user
 * setup file and `setupApp` run inside the framework context registered by
 * plugin setup code (all plugin setup code runs as one generated handler).
 * @param setupApi Story app setup API
 * @param hooks Lifecycle hooks of that app
 * @param beforeVariantSetup Runs between app-level setup and the variant
 * `setupApp`, which is read afterwards (the story mount pass registers it).
 */
export async function runSetupHooks(setupApi: Vue3StorySetupApi, hooks: Vue3AppHooks, beforeVariantSetup?: () => Promise<void>) {
  /** Runs one setup function, skipped once the story was closed. */
  async function run(handler: Vue3StorySetupHandler | undefined) {
    // A closed story's framework context may be gone: running more setup
    // would create resources nothing releases.
    if (typeof handler !== 'function' || hooks.retired) return
    await hooks.runWithContext(() => withStoryExecution(() => handler(setupApi), (setupApi.app as any).__HST_STORY_MOUNT_TARGET__))
  }

  await run(generatedSetup?.setupVue3)
  await run(setup?.setupVue3)
  if (beforeVariantSetup && !hooks.retired) await beforeVariantSetup()
  await run(setupApi.variant?.setupApp as Vue3StorySetupHandler | undefined)
}
