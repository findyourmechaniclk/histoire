import { describe, expect, it } from 'vitest'
import { defineFramePlugin, defineWorkbenchPlugin, PluginDefinitionError } from '../index.js'

/** Captures the thrown definition error so assertions can inspect attribution. */
function definitionError(run: () => unknown): PluginDefinitionError {
  try {
    run()
  }
  catch (error) {
    expect(error).toBeInstanceOf(PluginDefinitionError)
    return error as PluginDefinitionError
  }
  throw new Error('Expected definition to throw')
}

describe('defineWorkbenchPlugin', () => {
  it('returns the validated definition unchanged', () => {
    const setup = () => {}
    const definition = defineWorkbenchPlugin({ id: 'a11y-tools', apiVersion: 1, setup })
    expect(definition).toMatchObject({ id: 'a11y-tools', apiVersion: 1, setup })
  })

  it.each([
    ['empty', ''],
    ['uppercase', 'MyPlugin'],
    ['leading digit', '1plugin'],
    ['qualified', 'acme:tools'],
    ['non-string', 42],
  ])('rejects %s id', (_, id) => {
    const error = definitionError(() => defineWorkbenchPlugin({ id, apiVersion: 1, setup: () => {} } as any))
    expect(error.message).toContain(JSON.stringify(id))
  })

  it('rejects reserved builtin id', () => {
    const error = definitionError(() => defineWorkbenchPlugin({ id: 'builtin', apiVersion: 1, setup: () => {} }))
    expect(error.message).toMatch(/reserved/)
  })

  it('rejects unsupported apiVersion with plugin attribution', () => {
    const error = definitionError(() => defineWorkbenchPlugin({ id: 'acme', apiVersion: 2, setup: () => {} } as any))
    expect(error.pluginId).toBe('acme')
    expect(error.message).toContain('"acme"')
    expect(error.message).toContain('apiVersion')
  })

  it('rejects missing setup with plugin attribution', () => {
    const error = definitionError(() => defineWorkbenchPlugin({ id: 'acme', apiVersion: 1 } as any))
    expect(error.pluginId).toBe('acme')
    expect(error.message).toContain('setup')
  })

  it('rejects non-object definitions', () => {
    definitionError(() => defineWorkbenchPlugin(null as any))
  })
})

describe('defineFramePlugin', () => {
  it('returns the validated definition unchanged', () => {
    const attach = () => {}
    expect(defineFramePlugin({ id: 'acme', apiVersion: 1, attach })).toMatchObject({ id: 'acme', attach })
  })

  it('rejects invalid id, apiVersion and missing attach', () => {
    definitionError(() => defineFramePlugin({ id: 'builtin', apiVersion: 1, attach: () => {} }))
    expect(definitionError(() => defineFramePlugin({ id: 'acme', apiVersion: 0, attach: () => {} } as any)).pluginId).toBe('acme')
    expect(definitionError(() => defineFramePlugin({ id: 'acme', apiVersion: 1 } as any)).message).toContain('attach')
  })
})
