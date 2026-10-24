import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadQuasarConfig } from '../config/load.js'

const root = fileURLToPath(new URL('./fixtures/project', import.meta.url))

describe('loadQuasarConfig', () => {
  it('evaluates quasar.config with the Quasar CLI context and globals it relies on', async () => {
    const config = await loadQuasarConfig(root, true)
    expect(config.boot).toEqual(['axios'])
    expect(config.css).toEqual(['app.css'])
    // `__dirname` is per file, like Quasar CLI injects it.
    expect(config.extras).toEqual(['build'])
    expect(config.framework?.config).toEqual({ dark: true })
  })
})
