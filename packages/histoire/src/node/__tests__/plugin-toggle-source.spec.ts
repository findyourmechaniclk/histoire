import { describe, expect, it } from 'vitest'
import { analyzePluginSource, disablePluginEntry, enablePluginEntry } from '../config/plugin-toggle-source.js'

const source = `import { HstVue as Vue } from '@histoire/plugin-vue'
import { other } from 'other'
export default { plugins: [Vue({ /* keep */ option: true }), other()] }
`

describe('plugin config toggles', () => {
  it('disables and restores the exact factory without changing its neighbors', () => {
    const entries = analyzePluginSource(source)
    expect(entries.map(entry => entry.enabled)).toEqual([true, true])
    const disabled = disablePluginEntry(source, entries[0], { name: 'vue', displayName: 'Vue', client: true, frame: false })
    const restoredEntries = analyzePluginSource(disabled)
    expect(restoredEntries.map(entry => entry.enabled)).toEqual([false, true])
    expect(restoredEntries[0].metadata).toEqual({ name: 'vue', displayName: 'Vue', client: true, frame: false })
    expect(disabled).toMatch(/false \? \[\/\*histoire-plugin:[\w-]+\*\/Vue\(\{ \/\* keep \*\/ option: true \}\)\] : \[\]/)
    expect(enablePluginEntry(disabled, restoredEntries[0])).toBe(source)
  })

  it.each([
    'import { plugins } from "./plugins"; export default { plugins }',
    'import { a } from "a"; export default { plugins: [a(), ...extra] }',
    'import { a } from "a"; export default { plugins: [flag ? a() : a()] }',
    'export default { plugins: [local()] }',
  ])('refuses unsupported plugin arrays: %s', (code) => {
    expect(() => analyzePluginSource(code)).toThrow()
  })
})
