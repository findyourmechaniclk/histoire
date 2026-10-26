// @vitest-environment node
import { expect, it } from 'vitest'
import { compileStyles } from './compile-styles.test-support.mjs'

it('resolves app theme utilities through public host tokens', async () => {
  const entries: Record<string, string> = {
    'prose': '--tw-prose-body',
    'bg-surface': '--histoire-surface-rgb',
    'bg-accent/15': '--histoire-accent-alpha',
    'bg-accent-soft/15': '--histoire-accent-soft-alpha',
    'px-pane-gutter': '--histoire-pane-gutter',
    'h-control': '--histoire-control-height',
    'rounded-control': '--histoire-radius-control',
    'shadow-popover': '--histoire-shadow-popover',
    'ease-histoire': '--histoire-ease',
    'animate-skeleton-pulse': 'skeleton-pulse',
    'font-mono': '--histoire-font-mono',
    'text-primary-500': '--_histoire-color-primary-500',
  }
  for (const name of ['surface', 'canvas', 'home', 'border', 'chip', 'input', 'text', 'body', 'muted', 'accent', 'accent-soft', 'accent-text', 'accent-link', 'danger', 'danger-text', 'danger-soft', 'warn', 'agent', 'agent-text', 'agent-soft', 'measure', 'measure-gap', 'measure-padding', 'measure-margin', 'code']) {
    entries[`bg-${name}`] = `--histoire-${name}-rgb`
  }
  for (const name of ['control', 'button', 'panel']) entries[`rounded-${name}`] = `--histoire-radius-${name}`
  for (const name of ['toolbar', 'canvas-toolbar', 'popover', 'panel']) entries[`shadow-${name}`] = `--histoire-shadow-${name}`
  for (const name of ['settings', 'viewport', 'list', 'comment', 'mcp', 'story', 'test']) entries[`py-row-${name}`] = `--histoire-${name}-row-padding`
  for (const name of ['pane-gutter', 'pane-row-inset', 'inspector-gutter', 'control-padding', 'control-wrapper-padding', 'control-gap', 'control-margin']) entries[`p-${name}`] = `--histoire-${name}`
  entries['h-pane-header'] = '--histoire-pane-header-height'
  entries['py-test-heading'] = '--histoire-test-heading-padding'
  entries['font-sans'] = '--histoire-font-sans'
  for (const name of ['primary', 'gray']) {
    for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) entries[`text-${name}-${shade}`] = `--_histoire-color-${name}-${shade}`
  }
  for (const shade of [750, 850, 950]) entries[`text-gray-${shade}`] = `--_histoire-color-gray-${shade}`
  const prefix = ['htw', ':'].join('')
  const { root } = await compileStyles('histoire-app', 'src/app/style/main.css', Object.keys(entries).map(name => prefix + name))
  for (const [candidate, token] of Object.entries(entries)) {
    const selector = `.${prefix}${candidate}`.replaceAll(':', '\\:').replaceAll('/', '\\/')
    const rules: string[] = []
    root.walkRules((rule) => {
      if (rule.selector === selector) rules.push(rule.toString())
    })
    expect(rules.join('\n'), `Theme contract for ${candidate}`).toContain(token)
  }
})
