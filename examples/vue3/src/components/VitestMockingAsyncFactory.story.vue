<script lang="ts">
import { describe, expect, it, vi } from 'vitest'
import { useSharedLabel } from './vitest-mocking-label'

// Async factory importing a module: its import runs while the mock is being
// registered and must not wait for that registration.
vi.mock('./vitest-mocking-label', async () => {
  const { ref } = await import('vue')
  return {
    useSharedLabel: () => ref('Mocked by an async factory'),
  }
})
</script>

<script setup lang="ts">
import { onTest } from 'histoire/client'

const label = useSharedLabel()

onTest(({ canvas }) => {
  describe('async mock factory', () => {
    it('renders the value created by the factory', () => {
      expect(canvas.textContent).toContain('Mocked by an async factory')
    })
  })
})
</script>

<template>
  <Story title="Vitest Mocking Async Factory">
    <Variant title="default">
      <div data-test-id="async-factory-label">
        {{ label }}
      </div>
    </Variant>
  </Story>
</template>
