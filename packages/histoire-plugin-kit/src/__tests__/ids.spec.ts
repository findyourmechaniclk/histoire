import { describe, expect, it } from 'vitest'
import { BUILTIN_NAMESPACE, isValidPluginId, parseQualifiedId, PluginDefinitionError, qualifyId } from '../index.js'

describe('plugin ids', () => {
  it('accepts lowercase kebab ids and rejects reserved or malformed ones', () => {
    expect(isValidPluginId('acme')).toBe(true)
    expect(isValidPluginId('a11y-tools')).toBe(true)
    expect(isValidPluginId(BUILTIN_NAMESPACE)).toBe(false)
    expect(isValidPluginId('Acme')).toBe(false)
    expect(isValidPluginId('-acme')).toBe(false)
    expect(isValidPluginId(undefined)).toBe(false)
    // Channel messages reject longer ids, so definitions must too.
    expect(isValidPluginId('a'.repeat(65))).toBe(false)
  })
})

describe('qualified ids', () => {
  it('qualifies local contribution ids and parses them back', () => {
    const id = qualifyId('acme', 'contrast')
    expect(id).toBe('acme:contrast')
    expect(parseQualifiedId(id)).toEqual({ namespace: 'acme', localId: 'contrast' })
  })

  it('parses builtin ids but never qualifies plugin contributions under builtin', () => {
    expect(parseQualifiedId('builtin:props')).toEqual({ namespace: 'builtin', localId: 'props' })
    expect(() => qualifyId('builtin', 'props')).toThrow(PluginDefinitionError)
  })

  it('rejects local ids that would break qualification', () => {
    expect(() => qualifyId('acme', '')).toThrow(/"acme"/)
    expect(() => qualifyId('acme', 'a:b')).toThrow(PluginDefinitionError)
    expect(() => qualifyId('acme', 'has space')).toThrow(PluginDefinitionError)
  })

  it('returns null for unqualified or malformed ids', () => {
    expect(parseQualifiedId('docs')).toBeNull()
    expect(parseQualifiedId(':docs')).toBeNull()
    expect(parseQualifiedId('acme:')).toBeNull()
    expect(parseQualifiedId('acme:a:b')).toBeNull()
  })
})
