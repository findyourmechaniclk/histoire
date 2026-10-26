// @vitest-environment node
import { createRequire } from 'node:module'
import postcss from 'postcss'
import { expect, it } from 'vitest'
import { compileStyles } from './compile-styles.test-support.mjs'

const rootRequire = createRequire(new URL('../../../../package.json', import.meta.url))
// Use the real v3 compiler with the root theme, as an external consumer would.
const plugins = [rootRequire('tailwindcss')(rootRequire('./tailwind.config.cjs'))]

it.each([
  ['histoire-app', 'src/app/style/main.css'],
  ['histoire-controls', 'src/style/main.css'],
  ['histoire-controls', 'src/style/peer.css'],
])('keeps %s/%s consumable in a Tailwind v3 project', async (name, entry) => {
  const prefix = ['htw', ':'].join('')
  const generated = await compileStyles(name, entry, [`${prefix}translate-x-1`])
  // Real consumer compilers see their own path, not the workspace package path.
  const from = new URL('../../../../examples/vue3/src/consumer-test.css', import.meta.url).pathname
  const consumed = await postcss(plugins).process(generated.css, { from })
  const registrations: string[] = []
  consumed.root.walkAtRules('property', (rule) => {
    registrations.push(rule.params)
  })
  expect(registrations).toContain('--tw-translate-y')
})
