import { describe, expect, it } from 'vitest'
import { mergeConfig } from '../config/merge.js'

describe('mergeConfig', () => {
  it('accumulates viteNodeInlineDeps from plugins and user config', () => {
    const fromVuePlugin = { viteNodeInlineDeps: [/vuetify/] }
    const fromQuasarPlugin = { viteNodeInlineDeps: [/extras/] }
    const user = { viteNodeInlineDeps: ['my-lib'] }
    const merged = mergeConfig(user, mergeConfig(fromQuasarPlugin, fromVuePlugin) as any)
    expect(merged.viteNodeInlineDeps).toEqual(expect.arrayContaining([/vuetify/, /extras/, 'my-lib']))
    expect(merged.viteNodeInlineDeps).toHaveLength(3)
  })
})
