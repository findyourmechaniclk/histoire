import { expect, it } from 'vitest'
import { startPairing } from '../client/pairing-budget.js'

it('bounds unresolved browser pairing attempts until the upstream RPC settles', async () => {
  const connection = {}
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    const attempts = Array.from({ length: 32 }, () => startPairing(connection, () => held))
    expect(() => startPairing(connection, async () => 'extra')).toThrow('Pairing capacity reached')
    release()
    await Promise.all(attempts)
    expect(await startPairing(connection, async () => 'fresh')).toBe('fresh')
  }
  finally { release() }
})

it('retains admission after a wrapper timeout until the upstream timeout window', async () => {
  const connection = {}
  const timedOut = Array.from({ length: 32 }, () => startPairing(connection, () => Promise.reject(Object.assign(new Error('timeout'), { kind: 'timeout' })), 10))
  await Promise.allSettled(timedOut)
  expect(() => startPairing(connection, async () => 'extra')).toThrow('Pairing capacity reached')
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(await startPairing(connection, async () => 'fresh')).toBe('fresh')
})
