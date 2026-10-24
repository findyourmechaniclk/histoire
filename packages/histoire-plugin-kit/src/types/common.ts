/** Value or promise of value; plugin hooks may complete synchronously or asynchronously. */
export type Awaitable<T> = T | PromiseLike<T>

/** Releases one registration or resource; calling it more than once has no further effect. */
export type Disposer = () => void

/** Offline Carbon glyph name, as listed in Histoire's bundled icon set. */
export type WorkbenchIcon = string
