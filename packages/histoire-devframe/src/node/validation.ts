import type { LiveIdentity } from './types.js'
import { assertInspectionJson, measureWireValue } from '@histoire/protocol'

/** Bound JSON payloads before they cross a trust or transport boundary. */
export function bounded<T>(value: T, maxBytes: number): T {
  try {
    measureWireValue(value, { maxBytes, maxDepth: 32 })
    assertInspectionJson(value)
    return structuredClone(value)
  }
  catch { throw new Error('Invalid payload') }
}

/** Verify the private owner tuple returned by the trusted host. */
export function verifiedIdentity(value: unknown): LiveIdentity {
  const owner = bounded(value, 16 * 1024) as LiveIdentity
  if (!owner || typeof owner !== 'object' || !owner.target || typeof owner.target !== 'object') throw new Error('Pairing unavailable')
  for (const key of ['projectId', 'sourceId', 'epoch', 'revision', 'mountId', 'runtimeId'] as const) {
    if (typeof owner[key] !== 'string' || !owner[key] || owner[key].length > 2048) throw new Error('Pairing unavailable')
  }
  if (typeof owner.target.storyId !== 'string' || !owner.target.storyId || typeof owner.target.variantId !== 'string' || !owner.target.variantId) throw new Error('Pairing unavailable')
  const allowed = ['projectId', 'sourceId', 'epoch', 'revision', 'mountId', 'runtimeId', 'target']
  if (Object.keys(owner).some(key => !allowed.includes(key)) || Object.keys(owner.target).some(key => !['storyId', 'variantId'].includes(key))) throw new Error('Pairing unavailable')
  return owner
}

/** Read a finite host revision without leaking host callback errors. */
export function readAuthorityVersion(callback: () => number): number {
  let value: number
  try {
    value = callback()
  }
  catch { throw new Error('Session unavailable') }
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Session unavailable')
  return value
}

/** Treat host source-policy errors as denial. */
export function isSourceAllowed(callback: (url: string) => boolean, url: string): boolean {
  try {
    return callback(url) === true
  }
  catch { return false }
}
