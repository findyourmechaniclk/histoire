import { describe, expect, it } from 'vitest'
import { createFrameSnapshotStore } from '../../../../histoire-app/src/app/components/canvas/snapshots/store.js'
// @vitest-environment jsdom
import 'fake-indexeddb/auto'

const capture = (body: string, css = '.a{}') => ({ htmlAttributes: {}, bodyAttributes: {}, body, css })
let databases = 0

describe('canvas frame snapshot store', () => {
  it('returns the latest snapshot of a key with its styles', async () => {
    const store = createFrameSnapshotStore({ name: `snapshots-${databases++}` })
    await store.put('a', capture('first'), { size: { width: 640, height: 200 }, width: 640 })
    await store.put('a', capture('second'))
    expect(await store.get('a')).toMatchObject({ body: 'second', css: '.a{}' })
    expect(await store.get('b')).toBeUndefined()
  })

  it('keeps the most recent snapshots and the styles they use', async () => {
    const store = createFrameSnapshotStore({ name: `snapshots-${databases++}`, limit: 2 })
    await store.put('a', capture('a', '.old{}'))
    await store.put('b', capture('b'))
    await store.put('c', capture('c'))
    expect(await store.get('a')).toBeUndefined()
    expect(await store.get('b')).toMatchObject({ css: '.a{}' })
    expect(await store.stats()).toEqual({ snapshots: 2, styles: 1 })
  })
})
