import type { Context } from '../context.js'
import { describe, expect, it } from 'vitest'
import { resolvedConfig } from '../virtual/resolved-config.js'

describe('workbench public config', () => {
  it('never serializes agent environment secrets into development client modules', () => {
    const ctx = { mode: 'dev', config: { agents: { enabled: true, presets: [{ id: 'test', name: 'Test', command: 'agent', env: { TOKEN: 'private-secret' } }] } } } as Context
    const output = resolvedConfig(ctx)
    expect(output).not.toContain('private-secret')
    expect(output).not.toContain('TOKEN')
    expect(output).toContain('agent')
  })

  it('omits agent launch settings from static client modules', () => {
    const ctx = { mode: 'build', config: { agents: { enabled: true, presets: [{ command: 'private-command' }] }, ui: { frameBudget: 12 } } } as Context
    const output = resolvedConfig(ctx)
    expect(output).not.toContain('private-command')
    expect(output).toContain('"frameBudget":12')
  })

  it.each(['dev', 'build'] as const)('keeps Node plugin objects and Vite options out of %s client modules', (mode) => {
    const ctx = {
      mode,
      config: {
        plugins: [{ name: 'node-only-plugin', privateField: 'plugin-sentinel' }],
        vite: { define: { SECRET: 'vite-sentinel' } },
        ui: { frameBudget: 12 },
      },
    } as unknown as Context
    const output = resolvedConfig(ctx)
    expect(output).not.toContain('plugin-sentinel')
    expect(output).not.toContain('node-only-plugin')
    expect(output).not.toContain('vite-sentinel')
    expect(output).toContain('"frameBudget":12')
  })
})
