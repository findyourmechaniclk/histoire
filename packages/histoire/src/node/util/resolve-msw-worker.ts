import fs from 'fs-extra'
import { dirname, join } from 'pathe'
import { tryResolveDependency } from './resolve-package.js'

/**
 * Resolves the MSW service worker script, preferring the project's own `msw`
 * package: the worker version must match the msw runtime modules (also
 * resolved project-first), otherwise MSW logs "outdated worker" mismatch
 * warnings in the built app.
 * @param root The project root to resolve `msw` from first.
 * @param options Resolution options.
 * @param options.fallback Set to `false` to only accept the project's own install.
 * @returns The worker file path, or `null` when no msw install is found.
 */
export function resolveMswWorkerPath(root: string, options: { fallback?: boolean } = {}): string | null {
  const packageJsonPath = tryResolveDependency(root, 'msw/package.json', options)
  if (!packageJsonPath) {
    return null
  }

  const packageRoot = dirname(packageJsonPath)
  for (const candidate of [
    join(packageRoot, 'lib/mockServiceWorker.js'),
    join(packageRoot, 'mockServiceWorker.js'),
  ]) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}
