import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDefaultConfig } from '../config/index.js'
import { closeContext } from '../context.js'
import { resolveAccessibilityRuntime } from '../util/resolve-accessibility-runtime.js'
import { createHistoireVitePlugin } from '../vite/core-plugin.js'
import { resolveBrowserRuntimePaths } from '../vite/resolve-paths.js'
import { createMcpContext, createMcpProjectFixture } from './utils/mcp/project.js'

describe('accessibility browser module permissions', () => {
  it('allows only the resolved scanner directory when explicitly enabled', async () => {
    const fixture = await createMcpProjectFixture()
    const context = createMcpContext(fixture.root)
    context.config = getDefaultConfig()
    context.resolvedViteConfig = { root: fixture.root } as typeof context.resolvedViteConfig
    const paths = resolveBrowserRuntimePaths(context, false)
    /** Read the actual Vite plugin's public server permission configuration. */
    function allow() {
      const plugin = createHistoireVitePlugin(context, { isServer: false, browserRuntimePaths: paths })
      return (plugin.config as any)({}, { command: 'serve' }).server.fs.allow as string[]
    }
    try {
      const before = allow()
      context.config.inspection = { enabled: true, accessibility: true }
      const runtime = resolveAccessibilityRuntime(context.root, context.config.inspection)!
      expect(runtime).toBeTruthy()
      const after = allow()
      expect(after).toContain(dirname(runtime.scannerId))
      expect(after).not.toContain(dirname(runtime.axeId))
      expect(before).not.toContain(dirname(runtime.axeId))
      expect(after).not.toContain(resolve(dirname(runtime.axeId), '..'))
      expect(after).not.toContain(resolve(fixture.root, 'unrelated'))
    }
    finally {
      await closeContext(context)
      await fixture.close()
    }
  })

  it('does not expose modules when disabled or the optional engine is missing', () => {
    const missing = () => null
    expect(resolveAccessibilityRuntime('/project', { enabled: true, accessibility: true }, missing)).toBeUndefined()
    expect(resolveAccessibilityRuntime('/project', { enabled: false, accessibility: true }, () => {
      throw new Error('must not resolve')
    })).toBeUndefined()
  })
})
