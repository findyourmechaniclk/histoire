import { inspect, types } from 'node:util'

/** `stack` of any thrown value, when it carries one. */
function readStack(error: unknown): string | undefined {
  const stack = (error as { stack?: unknown } | null | undefined)?.stack
  return typeof stack === 'string' ? stack : undefined
}

/**
 * Readable text for any thrown value. Non-`Error` throws (plain objects,
 * strings, cloned DOMExceptions) have no `stack` to print.
 */
export function formatThrown(error: unknown): string {
  return readStack(error) ?? inspect(error, { depth: 4 })
}

/**
 * Converts a thrown value into a native `Error` before it leaves a collection
 * worker. Structured cloning keeps native errors' name, message and stack, but
 * turns anything else (e.g. jsdom's DOMException) into `{}`.
 */
export function toCloneableError(error: unknown): Error {
  if (types.isNativeError(error)) return error
  const source = error as { name?: unknown, message?: unknown } | null | undefined
  const wrapped = new Error(typeof source?.message === 'string' ? source.message : inspect(error, { depth: 4 }))
  if (typeof source?.name === 'string') wrapped.name = source.name
  // Keep the original stack; this module's frames would only mislead.
  wrapped.stack = readStack(error) ?? `${wrapped.name}: ${wrapped.message}`
  return wrapped
}

/**
 * Message for an error crashing a collection worker (uncaught exception or
 * unhandled rejection), attributed to the story file being collected.
 */
export function formatCollectCrash(error: unknown, storyPath: string | undefined): string {
  return `Uncaught error while collecting story ${storyPath ?? '(unknown)'}:\n${formatThrown(error)}`
}
