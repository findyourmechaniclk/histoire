// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { resolveVitestModule } from '../util/resolve-vitest-package.js'
import { MOCKER_HELPERS_SNIPPET } from '../virtual/mocker-snippet.js'

const { ModuleMocker } = await import(resolveVitestModule(process.cwd(), '@vitest/mocker/browser'))

/** Vitest's browser mocker with in-memory interceptor/RPC and Histoire's preload helper installed. */
function createMocker() {
  const mocker = new ModuleMocker(
    { register: async () => {}, delete: async () => {}, invalidate: async () => {} },
    {
      resolveId: async (id: string) => ({ id, url: id }),
      resolveMock: async (id: string) => ({ resolvedId: id, resolvedUrl: id, redirectUrl: null, needsInterop: false, mockType: 'manual' }),
      invalidate: async () => {},
    },
    () => ({}),
    { root: '/' },
  )
  // The helpers are generated code; `import.meta.hot` only exists in the page.
  // eslint-disable-next-line no-new-func -- running the emitted snippet is the point of this test
  new Function('mocker', `${MOCKER_HELPERS_SNIPPET.replaceAll('import.meta.hot', 'undefined')}\nenableManualMockPreload(mocker)`)(mocker)
  return mocker
}

/** Rejects instead of hanging the suite when the mock queue deadlocks. */
function withinDeadline<T>(promise: Promise<T>) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('mock queue deadlocked')), 1_000))])
}

describe('mock factory preload', () => {
  it('lets async factories import modules while they are preloaded', async () => {
    const mocker = createMocker()
    // Same shape as the transformed `vi.mock(id, async () => { await import('vue') })`:
    // the factory's own import goes through `wrapDynamicImport`.
    mocker.queueMock('/src/shared-now.ts', '/src/Story.vue', async () => {
      const { ref } = await mocker.wrapDynamicImport(async () => ({ ref: (value: number) => ({ value }) }))
      return { now: ref(42) }
    })

    // The story's import of the mocked module waits for the mock queue.
    await withinDeadline(mocker.wrapDynamicImport(async () => null))
    const [mockUrl] = mocker.registry.keys()
    const exports = await withinDeadline(mocker.resolveFactoryModule(mockUrl))
    expect(exports.now.value).toBe(42)
  })
})
