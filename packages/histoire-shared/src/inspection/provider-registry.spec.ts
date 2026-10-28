// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { getFrameworkInspection, invalidateFrameworkInspection, registerFrameworkInspection } from './provider-registry.js'
import * as otherBundle from './provider-registry.js?second-bundle'

describe('framework inspection registry', () => {
  it('shares exact root registrations across bundle copies and creates providers lazily', () => {
    const root = document.createElement('div')
    const other = document.createElement('div')
    let calls = 0
    const provider = {} as any
    const dispose = registerFrameworkInspection(root, () => {
      calls++
      return provider
    }, () => {})
    expect(calls).toBe(0)
    expect(otherBundle.getFrameworkInspection(other)).toBeUndefined()
    expect(otherBundle.getFrameworkInspection(root)).toBe(provider)
    expect(calls).toBe(1)
    dispose()
    expect(otherBundle.getFrameworkInspection(root)).toBeUndefined()
  })

  it('rejects ambiguous owners and stale disposal cannot remove a successor', () => {
    const root = document.createElement('div')
    const first = {} as any
    const second = {} as any
    const releaseFirst = registerFrameworkInspection(root, () => first, () => {})
    const releaseSecond = registerFrameworkInspection(root, () => second, () => {})
    expect(getFrameworkInspection(root)).toBeUndefined()
    releaseFirst()
    expect(getFrameworkInspection(root)).toBe(second)
    releaseFirst()
    expect(getFrameworkInspection(root)).toBe(second)
    releaseSecond()
    const third = {} as any
    const releaseThird = registerFrameworkInspection(root, () => third, () => {})
    releaseSecond()
    expect(getFrameworkInspection(root)).toBe(third)
    releaseThird()
    expect(getFrameworkInspection(root)).toBeUndefined()
  })

  it('invalidates current providers across bundle copies without losing the owner registration', () => {
    const root = document.createElement('div')
    let value = {} as any
    const first = value
    const dispose = registerFrameworkInspection(root, () => value, () => {
      value = {}
    })
    expect(getFrameworkInspection(root)).toBe(first)
    otherBundle.invalidateFrameworkInspection(root)
    expect(getFrameworkInspection(root)).not.toBe(first)
    dispose()
    invalidateFrameworkInspection(root)
    expect(getFrameworkInspection(root)).toBeUndefined()
  })
})
