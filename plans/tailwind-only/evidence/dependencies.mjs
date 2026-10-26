import { createRequire } from 'node:module'

/** Resolve existing workspace dependencies without installing or copying packages. */
export const requireHistoire = createRequire(new URL('../../../packages/histoire/package.json', import.meta.url))
/** Browser tooling belongs to the example that this capture exercises. */
export const requireExample = createRequire(new URL('../../../examples/vue3/package.json', import.meta.url))
