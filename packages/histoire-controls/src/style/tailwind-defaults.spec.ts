// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compileStyles } from './compile-styles.test-support.mjs'

// Keep test-only candidates out of Tailwind's source scanner.
const prefix = ['htw', ':'].join('')
const utilities = ['translate-x-1', 'ring-2', 'shadow-sm'].map(name => `${prefix}${name}`)

describe.each([
  ['histoire-controls', 'src/style/main.css'],
  ['histoire-controls', 'src/style/peer.css'],
  ['histoire-app', 'src/app/style/main.css'],
])('%s/%s Tailwind defaults', (packageName, entry) => {
  it('initializes Histoire utilities without resetting story transforms or rings', async () => {
    const { root } = await compileStyles(packageName, entry, utilities)
    const unsafe: string[] = []
    root.walkRules((rule) => {
      if (!rule.nodes.some(node => node.type === 'decl' && node.prop.startsWith('--tw-'))) return
      let owner: typeof rule | undefined = rule
      while (owner && !owner.selector.includes('.htw\\:')) {
        owner = owner.parent?.type === 'rule' ? owner.parent : undefined
      }
      if (!owner) unsafe.push(rule.selector)
    })
    expect(unsafe).toEqual([])
    const properties: string[] = []
    root.walkAtRules('property', (rule) => {
      properties.push(rule.params)
      expect(rule.parent?.type).toBe('root')
    })
    expect(properties).toEqual(expect.arrayContaining(['--tw-translate-y', '--tw-ring-shadow', '--tw-shadow']))
    for (const utility of utilities) {
      let found = false
      root.walkRules((rule) => {
        if (rule.selector.includes(utility.replace(':', '\\:'))) found = true
      })
      expect(found, `Missing compiled ${utility}`).toBe(true)
    }
  })
})
