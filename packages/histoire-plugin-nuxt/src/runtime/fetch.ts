import { createFetch } from 'ofetch'

/**
 * Creates Nuxt's `$fetch` for a story document. `window.fetch` is read on
 * every request, so fetch mocks installed later (e.g. `mockNetwork()` in a
 * variant's `setupApp`) also answer `$fetch` / `useFetch` calls.
 */
export function createNuxtFetch(win: Window & { Headers: typeof Headers }) {
  return createFetch({
    fetch: (input, init) => win.fetch(input, init),
    Headers: win.Headers,
  })
}
