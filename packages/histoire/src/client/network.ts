import type { RequestHandler } from 'msw'
// Static on purpose: a lazy `import()` goes through Vitest's browser mocker,
// which waits for module mocks while app plugins wait for this fetch.
import { getResponse } from 'msw'

/** Marks the fetch wrapper, so it is installed once per `window.fetch`. */
const MOCKED_FETCH = Symbol.for('histoire.mockNetwork')

/** Logs a mocked request, e.g. to the Events panel. */
type NetworkLogger = (name: string, data: { method: string, url: string, status: number }) => void

/**
 * Creates the network mocking API of `histoire/client`: `window.fetch` is
 * answered by msw request handlers, without a service worker. Requests no
 * handler answers reach the previous `window.fetch` unchanged.
 * @param log Called for every mocked response.
 */
export function createNetworkMock(log: NetworkLogger) {
  /** Handlers shared by every story, from the setup file. */
  let defaultHandlers: RequestHandler[] = []
  /** Handlers of the current variant, which take precedence over the defaults. */
  let variantHandlers: RequestHandler[] = []

  /** Wraps the current `window.fetch` unless it is already wrapped. */
  function install() {
    const previous = window.fetch
    if ((previous as any)?.[MOCKED_FETCH]) return
    const mockedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const handlers = [...variantHandlers, ...defaultHandlers]
      if (!handlers.length) return previous.call(window, input, init)
      // Resolve relative URLs like the browser does, also in Node collection.
      const request = typeof input === 'string' ? new Request(new URL(input, location.href), init) : new Request(input, init)
      const response = await getResponse(handlers, request)
      if (!response) return previous.call(window, input, init)
      log('fetch', { method: request.method, url: request.url, status: response.status })
      return response
    }
    Object.defineProperty(mockedFetch, MOCKED_FETCH, { value: true })
    window.fetch = mockedFetch
  }

  return {
    /**
     * Replaces the handlers of the current variant. Call it from a variant's
     * `setupApp`, so they exist before the story mounts and fetches.
     */
    mockNetwork(...handlers: RequestHandler[]) {
      variantHandlers = handlers
      install()
    },
    /**
     * Replaces the handlers answering every story. Call it at the top level of
     * the setup file, so they also answer requests made while the app boots.
     */
    mockNetworkDefaults(...handlers: RequestHandler[]) {
      defaultHandlers = handlers
      install()
    },
  }
}
