import { expect, it } from 'vitest'
import { createRpcBudget } from '../node/rpc-budget.js'

it('bounds unresolved upstream RPCs until their actual replies settle', async () => {
  const budget = createRpcBudget(2)
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    const first = budget.call(() => held)
    const second = budget.call(() => held)
    expect(() => budget.call(async () => 'extra')).toThrow('Transport capacity reached')
    release()
    await Promise.all([first, second])
    expect(await budget.call(async () => 'fresh')).toBe('fresh')
  }
  finally { release() }
})
