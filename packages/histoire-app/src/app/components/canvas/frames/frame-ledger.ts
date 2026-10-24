import type { ComputedRef, InjectionKey } from 'vue'
import { computed, inject, provide, shallowReactive, watch } from 'vue'

/**
 * One viewport's live frame budget. Every live story document counts against `total`:
 * reservations hold documents outside visible admission (the hidden Matrix primary),
 * and `available` is what remains for the active view's admission, which admits its
 * selected frame first.
 */
export interface CanvasFrameLedger {
  /** Approved maximum live documents for this viewport. */
  total: ComputedRef<number>
  /** Documents currently held outside visible admission. */
  reserved: ComputedRef<number>
  /** Slots left for visible-frame admission; never negative. */
  available: ComputedRef<number>
  /** Hold one slot for `owner`; a newer reservation of the same owner replaces it. Release is idempotent. */
  reserve: (owner: string) => () => void
  /**
   * Optional reservation (plugin leases): holds a slot only when `keep` slots stay available
   * afterwards for visible admission, so the selected frame is always admitted first.
   * Returns `null` when the budget is full.
   */
  tryReserve: (owner: string, keep?: number) => (() => void) | null
}

/** Create the budget ledger of one mounted canvas viewport. */
export function createCanvasFrameLedger(total: () => number): CanvasFrameLedger {
  // Token per owner lets a retired reservation release late without dropping its replacement.
  const holds = shallowReactive(new Map<string, symbol>())
  const budget = computed(total)
  const reserved = computed(() => holds.size)
  // Non-finite budgets pass through so admission keeps its existing normalization.
  const available = computed(() => Math.max(0, budget.value - reserved.value))

  /** Hold one slot for `owner`; see `CanvasFrameLedger.reserve`. */
  function reserve(owner: string): () => void {
    const token = Symbol(owner)
    holds.set(owner, token)
    return () => {
      if (holds.get(owner) === token) holds.delete(owner)
    }
  }

  return {
    total: budget,
    reserved,
    available,
    reserve,
    tryReserve(owner, keep = 1) {
      // A replacement of the same owner reuses its slot instead of taking another one.
      const free = available.value + (holds.has(owner) ? 1 : 0)
      return free - 1 >= keep ? reserve(owner) : null
    },
  }
}

const canvasFrameLedgerKey: InjectionKey<CanvasFrameLedger> = Symbol('histoire-canvas-frame-ledger')

/** Provide the budget ledger for one CanvasViewport and its views. */
export function provideCanvasFrameLedger(total: () => number): CanvasFrameLedger {
  const ledger = createCanvasFrameLedger(total)
  provide(canvasFrameLedgerKey, ledger)
  return ledger
}

/** Hold `owner`'s slot while `active` is true; synchronous so admission never over-admits first. */
export function holdCanvasFrameSlot(ledger: CanvasFrameLedger, owner: string, active: () => boolean): void {
  watch(active, (value, _, onCleanup) => {
    if (value) onCleanup(ledger.reserve(owner))
  }, { immediate: true, flush: 'sync' })
}

/** Read the nearest viewport budget ledger. */
export function useCanvasFrameLedger(): CanvasFrameLedger {
  const ledger = inject(canvasFrameLedgerKey, undefined)
  if (!ledger) throw new Error('Canvas frame budget requires provideCanvasFrameLedger().')
  return ledger
}
