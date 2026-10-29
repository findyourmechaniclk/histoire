import { defineConfig } from 'vitest/config'
import config from './vite.config.js'

/** Real browser checks run after Chromium installation, separately from unit suite. */
export default defineConfig({
  ...config,
  test: { ...config.test, include: ['src/__tests__/browser.spec.ts'], exclude: [] },
})
