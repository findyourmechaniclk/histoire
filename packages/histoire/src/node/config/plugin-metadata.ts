import type { Plugin, PluginMetadata } from '@histoire/shared'
import { readFile } from 'node:fs/promises'
import { histoireIconNames } from '@histoire/shared/dist/icons/index.js'
import { join } from 'pathe'
import { findProjectPackageDirectories } from '../util/resolve-package.js'

/** Validated public information projected into a browser module. */
export type PublicPluginMetadata = PluginMetadata

/** Accept bounded nonempty metadata rather than unexpected package JSON shapes. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= 2048 ? value.trim() : undefined
}

/** Admit only web URLs, excluding embedded credentials. */
function webUrl(value: unknown, httpsOnly = false): string | undefined {
  const raw = text(value)
  if (!raw) return
  try {
    const url = new URL(raw)
    if ((!['http:', 'https:'].includes(url.protocol)) || (httpsOnly && url.protocol !== 'https:') || url.username || url.password) return
    return url.href
  }
  catch { return undefined }
}

/** Convert common npm Git URLs to browser URLs without accepting arbitrary schemes. */
function repositoryUrl(value: unknown): string | undefined {
  const raw = text(typeof value === 'object' && value ? (value as { url?: unknown }).url : value)
  if (!raw) return
  const https = raw
    .replace(/^git\+https:\/\//, 'https://')
    .replace(/^(?:github:|git@github\.com:|git\+ssh:\/\/git@github\.com\/|git:\/\/github\.com\/)/, 'https://github.com/')
  const valid = webUrl(https)
  return valid?.replace(/\.git\/?$/, '')
}

/** Only exact npm package identities can be used as project-relative lookup paths. */
function isPackageName(value: string): boolean {
  return value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)
}

/** Read the nearest installed copy; mismatches and unreadable packages are ignored. */
async function packageMetadata(root: string, name: string): Promise<Record<string, unknown>> {
  if (!isPackageName(name)) return {}
  try {
    const directory = findProjectPackageDirectories(root, name)[0]
    if (!directory) return {}
    const value = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    return value && value.name === name ? value : {}
  }
  catch { return {} }
}

/** Resolve package fallback once per plugin, preserving duplicate identities and order. */
export async function resolvePluginMetadata(root: string, plugins: readonly Plugin[]): Promise<PublicPluginMetadata[]> {
  const icons = new Set(histoireIconNames)
  return Promise.all(plugins.map(async (plugin) => {
    const info = plugin.metadata ?? {}
    const pkg = await packageMetadata(root, plugin.name)
    const displayName = text(info.displayName)
    const description = text(info.description) ?? text(pkg.description)
    const icon = text(info.icon)
    const logoUrl = webUrl(info.logoUrl, true)
    const docsUrl = webUrl(info.docsUrl) ?? webUrl(pkg.homepage)
    const repoUrl = repositoryUrl(info.repoUrl) ?? repositoryUrl(pkg.repository)
    return {
      ...displayName ? { displayName } : {},
      ...description ? { description } : {},
      ...icon && icons.has(icon) ? { icon } : {},
      ...logoUrl ? { logoUrl } : {},
      ...docsUrl ? { docsUrl } : {},
      ...repoUrl ? { repoUrl } : {},
    }
  }))
}
