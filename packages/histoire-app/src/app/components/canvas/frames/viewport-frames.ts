import type { CanvasArrangement } from '../../../stores/canvas-arrangement.js'
import type { CanvasFrameAdmissionOptions } from '../frame-admission.js'
import type { CanvasFrameLayout } from '../frame-layout.js'
import type { CanvasStartupCoordinator } from '../frame-startup-coordinator.js'
import type { CanvasFrameLeasesOptions } from './frame-leases.js'
import { computed, onBeforeUnmount } from 'vue'
import { useCanvasFrameAdmission } from '../frame-admission.js'
import { rankCanvasStartupFrames } from '../frame-layout.js'
import { provideCanvasStartupCoordinator } from '../frame-startup-coordinator.js'
import { createCanvasFrameLeases } from './frame-leases.js'
import { holdCanvasFrameSlot, provideCanvasFrameLedger } from './frame-ledger.js'

/** Inputs of one viewport's live-frame budget. */
export interface ViewportFramesOptions extends Omit<CanvasFrameAdmissionOptions, 'budget'> {
  /** Approved maximum live documents, including selected frame and plugin leases. */
  budget: () => number
  /** Displayed arrangement, after Matrix fallback. */
  arrangement: () => CanvasArrangement
  /** Grid/List layout, ranked for startup. */
  frames: () => readonly CanvasFrameLayout[]
  /** Lease collaborators besides the ledger and coordinator owned here. */
  leases: Omit<CanvasFrameLeasesOptions, 'ledger' | 'startup'>
}

/**
 * Own one viewport's frame budget: the ledger (Matrix primary slot, plugin leases), visible
 * Grid/List admission inside what the ledger leaves, and the startup coordinator. Visible
 * frames start first, anchored on the selected frame; leased frames follow them.
 */
export function useViewportFrames(options: ViewportFramesOptions) {
  const ledger = provideCanvasFrameLedger(options.budget)
  // Hidden Matrix primary owns one slot while Matrix renders, reserved before its cells admit.
  holdCanvasFrameSlot(ledger, 'matrix-primary', () => options.arrangement() === 'matrix')
  const live = useCanvasFrameAdmission({ ...options, budget: () => ledger.available.value })
  let coordinator: CanvasStartupCoordinator | undefined
  const leases = createCanvasFrameLeases({ ...options.leases, ledger, startup: () => coordinator })
  // Grid/List frames keep their ranked order (selected anchor first) and leases follow. Single
  // and Matrix start their frames directly, so their ranked anchor never starts through the
  // coordinator: leases lead there instead of waiting behind it. The ranked part stays in
  // every arrangement; frames requested around an arrangement switch rely on it.
  const order = computed(() => {
    const ranked = rankCanvasStartupFrames(options.frames(), [...live.value], options.selected())
    const arrangement = options.arrangement()
    return arrangement === 'grid' || arrangement === 'list' ? [...ranked, ...leases.ids.value] : [...leases.ids.value, ...ranked]
  })
  coordinator = provideCanvasStartupCoordinator(order)
  onBeforeUnmount(leases.dispose)
  return { ledger, live, leases }
}
