/**
 * Messages of a dynamic `import()` whose module couldn't be fetched (Chromium,
 * Firefox, Safari): a network failure, unlike errors thrown by the module.
 */
export const MODULE_LOAD_FAILURE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/

/**
 * Whether an error comes from a module that failed to fetch, e.g. after a
 * dropped connection, rather than from code that ran.
 * @param error Any thrown or rejected value.
 */
export function isModuleLoadFailure(error: unknown): boolean {
  return MODULE_LOAD_FAILURE.test(String((error as { message?: unknown } | null)?.message ?? error))
}
