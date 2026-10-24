import type { CanvasScopedContext, CanvasToolPointerEvent, QualifiedContribution } from '../../../histoire-plugin-kit/src/index.js'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePointerPan } from '../../../histoire-app/src/app/components/canvas/pan/usePointerPan.js'
import { createPluginToolGesture } from '../../../histoire-app/src/app/components/canvas/tools/plugin-tool.js'
import { pointer } from './fixtures/pointer.js'

/** Capture surface relaying to a gesture over a real pointer-pan owner. */
function gestureFixture(handlers: Partial<QualifiedContribution<'canvas.tool'>> = {}) {
  const calls: string[] = []
  const tool = {
    kind: 'canvas.tool',
    id: 'acme:draw',
    pluginId: 'acme',
    localId: 'draw',
    label: 'Draw',
    icon: 'pen',
    onPointerDown: (event: CanvasToolPointerEvent) => calls.push(`down ${event.viewport.x}`),
    onPointerMove: (event: CanvasToolPointerEvent) => calls.push(`move ${event.viewport.x}`),
    onPointerUp: (event: CanvasToolPointerEvent) => calls.push(`up ${event.viewport.x}`),
    onCancel: () => calls.push('cancel'),
    ...handlers,
  } as QualifiedContribution<'canvas.tool'>
  const space = ref(false)
  const offset = ref({ x: 0, y: 0 })
  const pan = usePointerPan({ getTool: () => tool.id, getSpace: () => space.value, getOffset: () => offset.value, setOffset: value => offset.value = value })
  const fail = vi.fn()
  const gesture = createPluginToolGesture({
    pointerPan: pan,
    tool: () => tool,
    context: () => ({}) as CanvasScopedContext,
    describe: event => ({ event, viewport: { x: event.clientX, y: event.clientY }, canvas: { x: event.clientX, y: event.clientY }, frame: null }),
    fail,
  })
  const surface = document.createElement('div')
  let captured: number | undefined
  surface.setPointerCapture = vi.fn((id: number) => void (captured = id))
  surface.hasPointerCapture = vi.fn((id: number) => captured === id)
  surface.releasePointerCapture = vi.fn(() => void (captured = undefined))
  surface.addEventListener('pointerdown', event => gesture.pointerDown(event as PointerEvent))
  surface.addEventListener('pointermove', event => gesture.pointerMove(event as PointerEvent))
  surface.addEventListener('pointerup', event => gesture.pointerUp(event as PointerEvent))
  surface.addEventListener('pointercancel', event => gesture.pointerCancel(event as PointerEvent))
  return { calls, space, offset, gesture, surface, fail, isCaptured: () => captured !== undefined }
}

describe('plugin canvas tool gestures', () => {
  it('captures a primary gesture and reaches handlers in order, hover moves included', () => {
    const test = gestureFixture()
    test.surface.dispatchEvent(pointer('pointermove', { clientX: 1 }))
    test.surface.dispatchEvent(pointer('pointerdown', { clientX: 2 }))
    expect(test.isCaptured()).toBe(true)
    test.surface.dispatchEvent(pointer('pointermove', { clientX: 3 }))
    test.surface.dispatchEvent(pointer('pointerup', { clientX: 4 }))
    expect(test.isCaptured()).toBe(false)
    expect(test.calls).toEqual(['move 1', 'down 2', 'move 3', 'up 4'])
  })

  it.each([
    ['held Space', { button: 0 }],
    ['middle button', { button: 1 }],
  ])('leaves %s gestures to canvas panning', (_name, button) => {
    const test = gestureFixture()
    test.space.value = button.button === 0
    test.surface.dispatchEvent(pointer('pointerdown', { ...button, clientX: 10 }))
    test.surface.dispatchEvent(pointer('pointermove', { ...button, clientX: 30 }))
    test.surface.dispatchEvent(pointer('pointerup', { ...button, clientX: 30 }))
    expect(test.offset.value).toEqual({ x: 20, y: 0 })
    expect(test.calls).toEqual([])
  })

  it('cancels an active gesture once, releasing capture and ignoring its later pointer up', () => {
    const test = gestureFixture()
    test.surface.dispatchEvent(pointer('pointerdown', { clientX: 1 }))
    test.gesture.cancel()
    test.gesture.cancel()
    test.surface.dispatchEvent(pointer('pointerup', { clientX: 2 }))
    expect(test.isCaptured()).toBe(false)
    expect(test.calls).toEqual(['down 1', 'cancel'])
  })

  it('ends the gesture and reports a throwing handler', () => {
    const error = new Error('draw failed')
    const test = gestureFixture({
      onPointerMove: () => {
        throw error
      },
    })
    test.surface.dispatchEvent(pointer('pointerdown', { clientX: 1 }))
    test.surface.dispatchEvent(pointer('pointermove', { clientX: 2 }))
    expect(test.isCaptured()).toBe(false)
    expect(test.fail).toHaveBeenCalledWith(expect.objectContaining({ id: 'acme:draw' }), error)
    test.surface.dispatchEvent(pointer('pointerup', { clientX: 3 }))
    expect(test.calls).toEqual(['down 1'])
  })
})
