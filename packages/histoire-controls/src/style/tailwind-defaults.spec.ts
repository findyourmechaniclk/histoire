// @vitest-environment node
import { createRequire } from 'node:module'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
// Built at runtime: Histoire's Tailwind content globs scan this file, and
// literal class names would add these utilities to the published CSS.
const prefix = 'htw-'
const utilities = ['translate-x-1', 'ring-2', 'shadow'].map(name => `${prefix}${name}`)

/**
 * Compiles a few utilities relying on Tailwind 3 composed defaults
 * (`--tw-translate-*`, `--tw-ring-*`, `--tw-shadow`) with a Histoire config.
 */
async function compile(configPath: string) {
  const config = require(configPath)
  const result = await postcss([tailwindcss({
    ...config,
    content: [{ raw: `<div class="${utilities.join(' ')}"></div>`, extension: 'html' }],
  })]).process('@tailwind base;\n@tailwind utilities;', { from: undefined })
  return result.root
}

describe.each([
  ['@histoire/controls', '../../tailwind.config.cjs'],
  ['@histoire/app', '../../../histoire-app/tailwind.config.cjs'],
])('%s Tailwind defaults', (_name, configPath) => {
  it('never targets elements outside Histoire utilities', async () => {
    // Built sandboxes merge Histoire and story CSS. Universal `--tw-*` resets
    // would zero transforms/rings of story Tailwind 4 utilities (same variables).
    const root = await compile(configPath)
    const universal: string[] = []
    root.walkRules((rule) => {
      const setsTailwindVariables = rule.nodes.some(node => node.type === 'decl' && node.prop.startsWith('--tw-'))
      if (setsTailwindVariables && rule.selectors.some(selector => !selector.includes(`.${prefix}`))) universal.push(rule.selector)
    })
    expect(universal).toEqual([])
    // Histoire utilities still receive their defaults.
    const translateDefaults = root.nodes.find(node => node.type === 'rule' && node.selector === `.${utilities[0]}` && node.some(decl => decl.type === 'decl' && decl.prop === '--tw-translate-y'))
    expect(translateDefaults).toBeDefined()
  })
})
