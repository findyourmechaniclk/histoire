import { reactive, ref, toRaw } from '@histoire/vendors/vue'
import { describe, expect, it } from 'vitest'
import { _toRawDeep, applyStateToBindings } from '../../../../histoire-plugin-vue/src/client/app/util.js'
import { applyVariantStateUpdate, createVariantStateSyncGuards, getVariantStateKey } from '../../../../histoire-shared/src/variant-state.js'

describe('variant state sync guards', () => {
  it('apply state to exact variant resolved by id', () => {
    const variants = [
      { id: 'first', state: reactive({ text: 'alpha' }) },
      { id: 'third', state: reactive({ text: 'omega' }) },
    ]
    const guards = createVariantStateSyncGuards()

    const updatedVariant = applyVariantStateUpdate({
      storyId: 'story',
      variantId: 'third',
      state: { text: 'gamma' },
      getVariantById: variantId => variants.find(item => item.id === variantId),
      guards,
    })

    expect(updatedVariant).toBe(variants[1])
    expect(variants[0].state.text).toBe('alpha')
    expect(variants[1].state.text).toBe('gamma')
    expect(guards.consume(getVariantStateKey('story', 'third'))).toBe(true)
    expect(guards.consume(getVariantStateKey('story', 'first'))).toBe(false)
  })

  it('tracks pending sync suppressions per variant key', () => {
    const guards = createVariantStateSyncGuards()
    const firstKey = getVariantStateKey('story', 'first')
    const thirdKey = getVariantStateKey('story', 'third')

    guards.suppress(firstKey)
    guards.suppress(thirdKey)

    expect(guards.consume(firstKey)).toBe(true)
    expect(guards.consume(firstKey)).toBe(false)
    expect(guards.consume(thirdKey)).toBe(true)
  })
})

describe('_toRawDeep', () => {
  it('unwraps nested bundled refs without falling back to external vue helpers', () => {
    const state = reactive({
      nested: {
        label: ref('variant-local'),
      },
    })

    expect(_toRawDeep(state)).toEqual({
      nested: {
        label: 'variant-local',
      },
    })
  })
})

describe('applyStateToBindings', () => {
  it('leaves non-plain objects referenced by story setup bindings untouched', () => {
    class Clock {
      ticks = 1
    }
    const date = new Date(2026, 0, 1)
    const clock = new Clock()
    const bindings = reactive({
      now: { value: date },
      clock,
      state: { count: 1 },
      readonly: {
        get value() { return 'fixed' },
      },
    })

    // Serialized snapshot coming back from the controls: Date and class
    // instances lost their prototype, read-only values are plain data.
    applyStateToBindings(bindings, {
      now: { value: {} },
      clock: { ticks: 5 },
      state: { count: 2 },
      readonly: { value: 'changed' },
    })

    expect(bindings.now.value).toBe(date)
    expect(toRaw(bindings.clock)).toBe(clock)
    expect(clock.ticks).toBe(1)
    expect(bindings.state.count).toBe(2)
    expect(bindings.readonly.value).toBe('fixed')
  })

  it('merges cyclic structured-clone state into cyclic bindings', () => {
    const cycle: Record<string, any> = { label: 'cyclic' }
    cycle.self = cycle
    const bindings = reactive({ cycle, count: 1 })
    const next: Record<string, any> = { label: 'changed' }
    next.self = next

    applyStateToBindings(bindings, { cycle: next, count: 2 })

    expect(bindings.count).toBe(2)
    expect(bindings.cycle.label).toBe('changed')
    expect(toRaw(bindings.cycle.self)).toBe(cycle)
  })
})
