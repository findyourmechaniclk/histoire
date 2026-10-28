import { describe, expect, it } from 'vitest'
import { createAxeEngineModule } from '../virtual/axe-engine.js'

describe('local axe engine module', () => {
  it('rejects absent, changed, or ambiguous vendor anchors', () => {
    const header = '/*! axe v4.14.0 upstream license */\n'
    const valid = `${header}axe.version = '4.14.0';\nwindow.axe = axe;`
    const wrapped = createAxeEngineModule(valid)
    expect(wrapped.startsWith(header)).toBe(true)
    expect(wrapped).not.toContain('window.axe = axe;')
    expect(wrapped).toContain('export default __histoireAxeEngine')
    expect(() => createAxeEngineModule(valid.replace('4.14.0', '4.13.0'))).toThrow()
    expect(() => createAxeEngineModule(valid.replace('window.axe = axe;', ''))).toThrow()
    expect(() => createAxeEngineModule(`${valid}\nwindow.axe = axe;`)).toThrow()
    expect(() => createAxeEngineModule(valid.replace(header, ''))).toThrow()
  })
})
