import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { browserCollector } from '../virtual/browser-collector.js'
import { FRAME_PLUGINS_ID } from '../virtual/index.js'
import { buildTestHarnessSource } from '../virtual/test-harness.js'
import { vitestBrowserRuntime } from '../virtual/vitest-browser-runtime.js'
import { generatePreviewRuntimeSource } from './utils/preview-runtime-source.js'

/** Frame entries are only reachable through the manifest's lazy loaders. */
function importsFrameManifest(source: string) {
  return source.includes(FRAME_PLUGINS_ID)
}

describe('frame plugin module reachability', () => {
  it('imports the frame manifest from the preview runtime only, behind a dynamic import', () => {
    const source = generatePreviewRuntimeSource()
    expect(source.split(FRAME_PLUGINS_ID)).toHaveLength(2)
    expect(source).toContain(`import('${FRAME_PLUGINS_ID}')`)
  })

  it('skips the frame manifest import when no frame plugin is configured', () => {
    expect(importsFrameManifest(generatePreviewRuntimeSource(true, { framePlugins: false }))).toBe(false)
  })

  it.each([
    ['story collection', () => browserCollector({} as any, [])],
    ['vitest test harness', () => buildTestHarnessSource({ variantTestSessionId: '/stub/session.js', files: [], mountTimeoutMs: 1000 })],
    ['vitest browser runtime', () => vitestBrowserRuntime({ root: fileURLToPath(new URL('.', import.meta.url)) } as any)],
    ['in-document test mount', () => readFile(fileURLToPath(new URL('../virtual/variant-test-mount.ts', import.meta.url)), 'utf8')],
  ])('never reaches frame plugins from %s', async (_, generate) => {
    expect(importsFrameManifest(await generate())).toBe(false)
  })
})
