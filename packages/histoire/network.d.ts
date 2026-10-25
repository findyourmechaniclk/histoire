import type { RequestHandler } from 'msw'

/**
 * Answers `window.fetch` requests of the current variant with msw request
 * handlers (`http.get(...)`, ...), before `mockNetworkDefaults()` handlers.
 * Replaces the handlers of a previous call. Call it from a variant's `setupApp`.
 * Requests no handler answers reach the network.
 */
export function mockNetwork(...handlers: RequestHandler[]): void

/**
 * Answers `window.fetch` requests of every story with msw request handlers.
 * Call it at the top level of the setup file, so the handlers also answer
 * requests made while the app boots (e.g. Nuxt plugins).
 */
export function mockNetworkDefaults(...handlers: RequestHandler[]): void
