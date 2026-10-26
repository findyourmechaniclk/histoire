import { describe, expect, it, vi } from 'vitest'
import { getHistoireStyleFiles } from '../alias.js'
import { RESOLVED_PREVIEW_RUNTIME_ID } from '../virtual/index.js'
import { renderSandboxEntry } from '../vite/dev-html.js'

describe('renderSandboxEntry', () => {
  it('links the built Histoire styles under versioned URLs and boots the runtime directly', () => {
    const { style, bundledStyle } = getHistoireStyleFiles()
    const entry = renderSandboxEntry(file => `${file}?v=hst-test`)

    expect(entry.head).toContain(`<link rel="stylesheet" href="/@fs/${style}?v=hst-test">`)
    expect(entry.head).toContain(`<link rel="stylesheet" href="/@fs/${bundledStyle}?v=hst-test">`)
    // The `<link>` order keeps app styles before the bundled component styles.
    expect(entry.head.indexOf(style)).toBeLessThan(entry.head.indexOf(bundledStyle))
    expect(entry.script).toBe(`<script type="module" src="${RESOLVED_PREVIEW_RUNTIME_ID}" onerror="__histoireEntryFailed()"></script>`)
  })
})

// Source workbench modules still need compiled v4 CSS in a v3 example project.
it('resolves compiled styles while HISTOIRE_DEV loads source modules', () => {
  vi.stubEnv('HISTOIRE_DEV', 'true')
  try {
    const { style, bundledStyle } = getHistoireStyleFiles()
    expect(style).toMatch(/\/histoire-app\/dist\/style\.css$/)
    expect(bundledStyle).toMatch(/\/histoire-app\/dist\/bundled\/app\.css$/)
  }
  finally {
    vi.unstubAllEnvs()
  }
})
