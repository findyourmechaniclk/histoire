import { describe, expect, it } from 'vitest'
import { getUiLibraryInlineDeps } from '../../../../histoire-plugin-vue/src/util/ui-libraries.js'

describe('vue UI library inline deps', () => {
  it('matches known library package folders only', () => {
    const deps = getUiLibraryInlineDeps()
    const matches = (id: string) => deps.some(re => re.test(id))
    expect(matches('/project/node_modules/.pnpm/vuetify@3.7.5/node_modules/vuetify/lib/components/VBtn/VBtn.mjs')).toBe(true)
    expect(matches('C:\\project\\node_modules\\@ionic\\vue\\dist\\index.js')).toBe(true)
    expect(matches('/project/node_modules/vuetify-extra/index.js')).toBe(false)
    expect(matches('/project/src/components/Button.vue')).toBe(false)
    // A project living in a folder named like a library must not inline everything.
    expect(matches('/home/me/quasar/node_modules/axios/index.js')).toBe(false)
  })
})
