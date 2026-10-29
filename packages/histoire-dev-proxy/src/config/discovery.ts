import { existsSync } from 'node:fs'
import path from 'node:path'

/** Histoire config discovery priority, shared with runtime config loader. */
export const configFileNames = ['histoire.config.ts', 'histoire.config.js', '.histoire.ts', '.histoire.js']
/** Vite config discovery priority. */
export const viteConfigFileNames = ['vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'vite.config.cjs', 'vite.config.mts', 'vite.config.cts']

/** Finds selected Histoire configuration without importing or evaluating it. */
export function resolveConfigFile(cwd = process.cwd(), configFile?: string): string | null {
  if (configFile) return path.resolve(cwd, configFile)
  let directory = path.resolve(cwd)
  while (directory !== path.dirname(directory)) {
    for (const name of configFileNames) {
      const file = path.join(directory, name)
      if (existsSync(file)) return file
    }
    directory = path.dirname(directory)
  }
  return null
}

/** Resolves ordered discovery candidates below one directory. */
export function localConfigFiles(root: string, names: readonly string[]): string[] {
  return names.map(name => path.join(root, name))
}

/** Covers local candidates which can supersede selected inherited configuration. */
export function histoireConfigFiles(root: string, config: string | undefined, acquired: string | null): string[] {
  if (config) return []
  const acquiredDirectory = acquired ? path.dirname(acquired) : null
  const directories = [root]
  let directory = root
  if (acquiredDirectory) {
    while (directory !== acquiredDirectory) {
      const parent = path.dirname(directory)
      if (parent === directory) break
      directories.push(parent)
      directory = parent
    }
  }
  return directories.flatMap((directory) => {
    const index = directory === acquiredDirectory && acquired ? configFileNames.indexOf(path.basename(acquired)) : -1
    return localConfigFiles(directory, index < 0 ? configFileNames : configFileNames.slice(0, index + 1))
  })
}

/** Retains selected inputs plus paths that can overtake them by priority. */
export function watchedConfigFiles(candidates: readonly string[], current: string | null, acquired: string | null): string[] {
  const selected = current ?? acquired
  const index = selected ? candidates.indexOf(selected) : -1
  const files = new Set(index < 0 ? candidates : candidates.slice(0, index + 1))
  if (current) files.add(current)
  if (acquired) files.add(acquired)
  return [...files]
}
