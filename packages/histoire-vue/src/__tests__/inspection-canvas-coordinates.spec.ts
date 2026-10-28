import { expect, it, onTestFinished } from 'vitest'
import { createCanvasFrames } from '../../../histoire-app/src/app/composables/canvas-settings.js'
import { createCanvasService } from '../../../histoire-app/src/app/extensions/canvas-service.js'
import { createCanvasStore } from '../../../histoire-app/src/app/stores/canvas.js'

it('maps a pointer through the exact rendered frame and rejects unavailable frames', () => {
  const canvas = createCanvasStore()
  const frames = createCanvasFrames(canvas)
  const viewport = document.createElement('div')
  const first = document.createElement('iframe')
  const second = document.createElement('iframe')
  // jsdom has no layout engine; supply the browser-measured boxes for coordinate conversion.
  viewport.getBoundingClientRect = () => ({ left: 40, top: 100, width: 900, height: 600 }) as DOMRect
  first.getBoundingClientRect = () => ({ left: 100, top: 200, width: 200, height: 120 }) as DOMRect
  second.getBoundingClientRect = () => ({ left: 400, top: 180, width: 100, height: 100 }) as DOMRect
  frames.registerFrame({ id: 'one', storyId: 'story', variantId: 'one', rect: { x: 0, y: 0, width: 1000, height: 600 }, iframe: first })
  frames.registerFrame({ id: 'two', storyId: 'story', variantId: 'two', rect: { x: 0, y: 0, width: 400, height: 400 }, iframe: second })
  frames.registerFrame({ id: 'placeholder', storyId: 'story', variantId: 'three', rect: { x: 0, y: 0, width: 400, height: 400 } })
  const handle = createCanvasService({ canvas, frames, viewport: () => viewport, acquireFrame: async () => {
    throw new Error('Unexpected lease')
  } })
  onTestFinished(handle.dispose)
  expect(handle.service.viewportToFrame!('one', { x: 110, y: 130 })).toEqual({ x: 250, y: 150 })
  expect(handle.service.viewportToFrame!('two', { x: 410, y: 130 })).toEqual({ x: 200, y: 200 })
  expect(handle.service.viewportToFrame!('placeholder', { x: 110, y: 130 })).toBeNull()
  expect(handle.service.viewportToFrame!('missing', { x: 110, y: 130 })).toBeNull()
  expect(handle.service.frameToViewport('one', { x: 250, y: 150 })).toEqual({ x: 110, y: 130 })
})
