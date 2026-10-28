import type { Exposure } from './types.js'
import { createHash, randomBytes } from 'node:crypto'

/** Canonical HTTP source without credentials, query or fragment. */
export function canonicalSource(input: string): string {
  if (typeof input !== 'string' || !input || input.length > 2048) throw new Error('Invalid source')
  let url: URL
  try {
    url = new URL(input)
  }
  catch { throw new Error('Invalid source') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid source')
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}

/** Bounded single-use grants retain secret hashes only. */
export function createGrants() {
  const entries = new Map<string, { principal: string, sourceUrl: string, scopes: Exposure[], expiresAt: number, authorityVersion: number }>()
  /** Secrets never enter stored metadata or error messages. */
  function hash(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }
  /** Expire abandoned grants before capacity checks or redemption. */
  function prune() {
    for (const [key, grant] of entries) {
      if (grant.expiresAt <= Date.now()) entries.delete(key)
    }
  }
  return {
    create(input: { principal: string, sourceUrl: string, scopes: readonly Exposure[], authorityVersion: number }) {
      prune()
      if (entries.size >= 128) throw new Error('Pairing capacity reached')
      if (!input.principal || input.principal.length > 1024 || !Array.isArray(input.scopes) || input.scopes.length > 6 || new Set(input.scopes).size !== input.scopes.length || input.scopes.some(scope => !['inspection', 'events', 'diagnostics', 'components', 'accessibility', 'highlight'].includes(scope))) throw new Error('Invalid grant')
      const token = randomBytes(32).toString('base64url')
      const expiresAt = Date.now() + 60_000
      entries.set(hash(token), { principal: input.principal, sourceUrl: canonicalSource(input.sourceUrl), scopes: [...input.scopes], expiresAt, authorityVersion: input.authorityVersion })
      return { token, expiresAt }
    },
    redeem(token: unknown, principal: string, sourceUrl: string, authorityVersion: number) {
      prune()
      if (typeof token !== 'string' || token.length > 128) throw new Error('Pairing unavailable')
      const key = hash(token)
      const grant = entries.get(key)
      if (!grant || grant.principal !== principal || grant.sourceUrl !== sourceUrl || grant.authorityVersion !== authorityVersion) throw new Error('Pairing unavailable')
      entries.delete(key)
      return grant
    },
    clear() { entries.clear() },
  }
}
