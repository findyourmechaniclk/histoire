import type { CanvasViewInput } from '../../../histoire-plugin-kit/src/index.js'
import type { PointerFields } from './fixtures/pointer.js'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canvasPluginFixture } from './fixtures/canvas-plugins.js'
import { pointer } from './fixtures/pointer.js'

const replica = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../../../histoire-app/src/app/components/canvas/frame-replica.js', () => ({ createCanvasReplicaSession: replica.create }))
afterEach(() => {
  replica.create.mockReset()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

/**
 * Canvas showing an `acme:board` view: a full-size background marked as a pan area holding one
 * focusable card that records the presses it receives.
 */
async function boardFixture() {
  const received = vi.fn()
  const view: CanvasViewInput = { id: 'board', label: 'Board', icon: 'view', mount(container) {
    const background = container.appendChild(document.createElement('div'))
    background.setAttribute('data-histoire-canvas-pan', '')
    const card = background.appendChild(document.createElement('div'))
    card.tabIndex = 0
    card.addEventListener('pointerdown', received)
  } }
  const test = await canvasPluginFixture(replica.create, api => api.canvas.addView(view))
  test.arrange.value = 'acme:board'
  await flushPromises()
  const viewport = test.viewport.element as HTMLElement
  const background = viewport.querySelector<HTMLElement>('[data-histoire-canvas-pan]')!
  const card = background.firstElementChild as HTMLElement
  /**
   * Press `target`, drag it 30px right, release.
   * @param target Pressed element.
   * @param values Pointer fields of the press.
   */
  function drag(target: HTMLElement, values: PointerFields = {}): void {
    target.dispatchEvent(pointer('pointerdown', { ...values, clientX: 10, clientY: 10 }))
    target.dispatchEvent(pointer('pointermove', { ...values, clientX: 40, clientY: 10 }))
    target.dispatchEvent(pointer('pointerup', { ...values, clientX: 40, clientY: 10 }))
  }
  return { ...test, received, viewport, background, card, drag }
}

describe('custom canvas view pointer input', () => {
  it('lets a primary press on view content reach the view without panning or moving focus to the canvas', async () => {
    const test = await boardFixture()
    test.card.focus()
    const pan = { ...test.canvas.panOffset }
    test.drag(test.card)
    expect(test.received).toHaveBeenCalledOnce()
    expect(test.canvas.panOffset).toEqual(pan)
    expect(document.activeElement).toBe(test.card)
  })

  it.each([
    { name: 'Pan tool', tool: 'pan' as const, space: false, button: 0 },
    { name: 'held Space', tool: 'select' as const, space: true, button: 0 },
    { name: 'middle button', tool: 'select' as const, space: false, button: 1 },
  ])('pans over view content with the $name and keeps the press from the view', async ({ tool, space, button }) => {
    const test = await boardFixture()
    test.canvas.setTool(tool)
    if (space) test.viewport.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))
    await flushPromises()
    const pan = { ...test.canvas.panOffset }
    test.drag(test.card, { button })
    expect(test.canvas.panOffset).toEqual({ x: pan.x + 30, y: pan.y })
    expect(test.received).not.toHaveBeenCalled()
  })

  it('treats a press on a pan area like empty canvas', async () => {
    const test = await boardFixture()
    test.card.focus()
    test.drag(test.background)
    expect(document.activeElement).toBe(test.viewport)
    test.canvas.setTool('pan')
    const pan = { ...test.canvas.panOffset }
    test.drag(test.background)
    expect(test.canvas.panOffset).toEqual({ x: pan.x + 30, y: pan.y })
  })
})
