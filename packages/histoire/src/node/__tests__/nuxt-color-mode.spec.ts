// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { reactive, watch } from 'vue'
import { createColorModeSync } from '../../../../histoire-plugin-nuxt/src/runtime/color-mode.js'

const options = { globalName: '__TEST_COLOR_MODE__', classPrefix: '', classSuffix: '-mode', dataValue: 'theme' }

afterEach(() => {
  delete (window as any)[options.globalName]
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
})

describe('plugin-nuxt color mode', () => {
  it('installs the helper the color-mode plugin reads, following Histoire dark mode', () => {
    const sync = createColorModeSync(window, options)
    const helper = (window as any)[options.globalName]
    expect(helper.preference).toBe('system')
    expect(helper.getColorScheme()).toBe('light')
    expect(document.documentElement.classList.contains('light-mode')).toBe(true)

    sync(true)
    expect(helper.getColorScheme()).toBe('dark')
    expect(helper.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark-mode')).toBe(true)
    expect(document.documentElement.classList.contains('light-mode')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    // One helper per document: the color-mode plugin reads it once.
    createColorModeSync(window, options)
    expect((window as any)[options.globalName]).toBe(helper)
  })

  it('updates the app color mode state once the plugin provided it', () => {
    const sync = createColorModeSync(window, options)
    const helper = (window as any)[options.globalName]
    // Same wiring as `@nuxtjs/color-mode`'s client plugin.
    const state = reactive({ preference: 'system', value: helper.value, forced: false })
    watch(() => state.value, (value, old) => {
      helper.removeColorScheme(old)
      helper.addColorScheme(value)
    }, { flush: 'sync' })

    sync(true, state)
    expect(state.value).toBe('dark')
    expect(document.documentElement.className).toBe('dark-mode')

    // A story choosing its own color mode keeps it.
    state.preference = 'light'
    sync(false, state)
    sync(true, state)
    expect(state.value).toBe('dark')
    expect(helper.getColorScheme()).toBe('dark')
  })
})
