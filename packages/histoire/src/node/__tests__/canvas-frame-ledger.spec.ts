import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useCanvasFrameAdmission } from '../../../../histoire-app/src/app/components/canvas/frame-admission.js'
import { layoutCanvasFrames } from '../../../../histoire-app/src/app/components/canvas/frame-layout.js'
import { createCanvasFrameLedger } from '../../../../histoire-app/src/app/components/canvas/frames/frame-ledger.js'

let scope = effectScope()

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

/** Admit three stacked frames through one viewport ledger, as Grid/List and Matrix do. */
function ledgerFixture(total: number, selectedIndex?: number) {
  const budget = ref(total)
  const ledger = createCanvasFrameLedger(() => budget.value)
  const frames = layoutCanvasFrames('story', ['a', 'b', 'c'], { width: 100, height: 100 }, 'list')
  const selected = selectedIndex === undefined ? null : frames[selectedIndex].id
  const live = scope.run(() => useCanvasFrameAdmission({
    frames: () => frames,
    viewport: () => ({ x: 0, y: 0, width: 400, height: 2000 }),
    budget: () => ledger.available.value,
    selected: () => selected,
    moving: () => false,
    context: () => 'story',
  }))!
  return { budget, ledger, frames, live }
}

describe('canvas frame budget ledger', () => {
  it('lends the whole viewport budget to visible admission when nothing is reserved', () => {
    const test = ledgerFixture(2)
    expect(test.live.value.size).toBe(2)
    test.budget.value = 3
    expect(test.live.value.size).toBe(3)
  })

  it('counts a hidden document against the same budget and returns its slot on release', () => {
    const test = ledgerFixture(3)
    const release = test.ledger.reserve('matrix-primary')
    expect(test.ledger.available.value).toBe(2)
    expect(test.live.value.size).toBe(2)
    release()
    expect(test.live.value.size).toBe(3)
  })

  it('admits the selected frame first inside what reservations leave', () => {
    const test = ledgerFixture(2, 2)
    test.ledger.reserve('matrix-primary')
    expect([...test.live.value]).toEqual([test.frames[2].id])
  })

  it('leaves only placeholders when reservations consume the whole budget', () => {
    const test = ledgerFixture(1)
    test.ledger.reserve('matrix-primary')
    expect(test.ledger.available.value).toBe(0)
    expect(test.live.value.size).toBe(0)
  })

  it('keeps a replacement reservation when the retired owner releases late', () => {
    const test = ledgerFixture(3)
    const retired = test.ledger.reserve('matrix-primary')
    const current = test.ledger.reserve('matrix-primary')
    expect(test.ledger.available.value).toBe(2)
    retired()
    expect(test.ledger.available.value).toBe(2)
    current()
    current()
    expect(test.ledger.available.value).toBe(3)
  })
})
