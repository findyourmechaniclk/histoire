import { describe, expect, it } from 'vitest'
import { HstVue } from '../../../../histoire-plugin-vue/src/index.node.ts'

describe('hstVue collect transform', () => {
  it('stubs unknown components and preserves bare vitest imports', () => {
    const plugin = HstVue().config().vite.plugins[0]
    const source = `
import { describe, it } from 'vitest'
import { _resolveComponent } from "vue"

_resolveComponent("HstButton")
`

    const transformed = plugin.transform.call({
      meta: {
        histoire: {
          isCollecting: true,
        },
      },
    }, source, '/virtual/Example.story.vue')

    expect(typeof transformed).toBe('string')
    expect(transformed).toContain('const _stubComponent =')
    expect(transformed).toContain(`from 'vitest'`)
    expect(transformed).not.toContain('vitest-collect')
    expect(transformed).toContain('_stubComponent("HstButton")')
  })
})

describe('hstVue collect Vapor SFCs', () => {
  /** Runs the collect-time pre transform on one SFC source. */
  function transform(source: string, isCollecting: boolean) {
    const plugin = HstVue().config().vite.plugins.find(item => item.name === 'histoire-plugin-vue:collect-vapor')
    return plugin.transform.call({ meta: { histoire: { isCollecting } } }, source, '/src/Flag.vue')
  }

  const source = `<script setup lang="ts" vapor>
const vapor = true
</script>

<template>
  <span vapor>{{ vapor }}</span>
</template>
`

  it('compiles Vapor SFCs as VDOM components during collection', () => {
    // Node collection runs Vue's CJS build, which has no Vapor runtime.
    const transformed = transform(source, true)
    expect(transformed).toContain('<script setup lang="ts">')
    expect(transformed).toContain('const vapor = true')
    expect(transformed).toContain('<span vapor>')
  })

  it('keeps Vapor mode outside collection', () => {
    expect(transform(source, false)).toBeUndefined()
  })
})
