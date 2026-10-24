import type { CanvasToolInput, Disposer } from '../../../histoire-plugin-kit/src/index.js'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readCanvasPreferences } from '../../../histoire-app/src/app/stores/canvas-preferences.js'
import { memoryStorage } from '../../../histoire/src/node/__tests__/utils/settings-storage.js'
import { canvasPluginFixture } from './fixtures/canvas-plugins.js'
import { pointer } from './fixtures/pointer.js'

/** Pointer position inside the canvas. */
const inside = { clientX: 5, clientY: 5 }

const replica = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../../../histoire-app/src/app/components/canvas/frame-replica.js', () => ({ createCanvasReplicaSession: replica.create }))
afterEach(() => {
  replica.create.mockReset()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

/** Viewport with one `acme:draw` tool whose registration the test can withdraw. */
async function toolFixture(tool: Partial<CanvasToolInput> = {}, preferences?: Record<string, unknown>) {
  const handlers = { onPointerDown: vi.fn(), onPointerUp: vi.fn(), onCancel: vi.fn() }
  let remove!: Disposer
  const test = await canvasPluginFixture(replica.create, (api) => {
    remove = api.canvas.addTool({ id: 'draw', label: 'Draw', icon: 'pen', shortcut: ['d'], ...handlers, ...tool })
  }, { preferences })
  /** Capture surface rendered while the plugin tool is active. */
  const surface = () => test.viewport.element.querySelector<HTMLElement>('[data-histoire-tool]')
  return { ...test, handlers, remove: () => remove(), surface }
}

/** Stub pointer capture on an element (JSDOM lacks it) and report its state. */
function captureProbe(element: HTMLElement) {
  let captured: number | undefined
  element.setPointerCapture = (id: number) => void (captured = id)
  element.hasPointerCapture = (id: number) => captured === id
  element.releasePointerCapture = () => void (captured = undefined)
  return () => captured !== undefined
}

describe('plugin canvas tools', () => {
  it('activates a tool through its shortcut in the workbench registry', async () => {
    const test = await toolFixture()
    const handled = test.shortcuts.handle(new KeyboardEvent('keydown', { key: 'd' }), ['canvas'], true)
    expect(handled).toBe(true)
    expect(test.canvas.tool).toBe('acme:draw')
    test.remove()
    await flushPromises()
    expect(test.shortcuts.entries.has('acme:draw')).toBe(false)
  })

  it('keeps a remembered plugin tool that registers, and falls back to Select for one that does not', async () => {
    const kept = await toolFixture({}, { tool: 'acme:draw' })
    expect(kept.canvas.tool).toBe('acme:draw')
    expect(kept.surface()).not.toBeNull()
    const missing = await toolFixture({}, { tool: 'acme:gone' })
    expect(missing.canvas.tool).toBe('select')
    const storage = memoryStorage()
    storage.setItem('_histoire-ui-canvas', JSON.stringify({ tool: 'lasso' }))
    expect(readCanvasPreferences(storage).tool).toBe('select')
  })

  it('cancels the gesture, releases capture and returns to Select when the active tool is removed', async () => {
    const test = await toolFixture()
    test.canvas.setTool('acme:draw')
    await flushPromises()
    const surface = test.surface()!
    const captured = captureProbe(surface)
    surface.dispatchEvent(pointer('pointerdown', inside))
    expect(test.handlers.onPointerDown).toHaveBeenCalledTimes(1)
    expect(captured()).toBe(true)
    test.remove()
    await flushPromises()
    expect(test.handlers.onCancel).toHaveBeenCalledTimes(1)
    expect(captured()).toBe(false)
    expect(test.canvas.tool).toBe('select')
    expect(test.surface()).toBeNull()
  })

  it('cancels the active gesture on Escape', async () => {
    const test = await toolFixture()
    test.canvas.setTool('acme:draw')
    await flushPromises()
    test.surface()!.dispatchEvent(pointer('pointerdown', inside))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    test.surface()!.dispatchEvent(pointer('pointerup', inside))
    expect(test.handlers.onCancel).toHaveBeenCalledTimes(1)
    expect(test.handlers.onPointerUp).not.toHaveBeenCalled()
  })

  it('records a failing tool and deactivates it to Select', async () => {
    const test = await toolFixture({
      onPointerDown: () => {
        throw new Error('draw failed')
      },
    })
    test.canvas.setTool('acme:draw')
    await flushPromises()
    test.surface()!.dispatchEvent(pointer('pointerdown', inside))
    await flushPromises()
    expect(test.canvas.tool).toBe('select')
    expect(test.workbench.host.diagnostics()).toContainEqual(expect.objectContaining({ pluginId: 'acme', contributionId: 'acme:draw' }))
  })
})
