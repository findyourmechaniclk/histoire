import type { ASTNode } from 'magicast'
import { Buffer } from 'node:buffer'
import { locateConfigObject } from './codemod/locate.js'
import { parseConfigCode, unwrapNode } from './codemod/parse.js'
import { findProperty } from './codemod/walk.js'

/** Public plugin information retained when its factory is disabled. */
export interface DisabledPluginMetadata {
  /** Stable plugin identity. */
  name: string
  /** Public workbench identity, when present. */
  id?: string
  /** Whether a workbench entry exists. */
  client: boolean
  /** Whether a frame entry exists. */
  frame: boolean
  /** Human-readable plugin name. */
  displayName?: string
  /** Public description. */
  description?: string
  /** Offline icon name. */
  icon?: string
  /** HTTPS logo address. */
  logoUrl?: string
  /** Documentation address. */
  docsUrl?: string
  /** Repository address. */
  repoUrl?: string
  /** Used only to suppress development-only entries in static inventories. */
  devOnly?: boolean
}

/** One directly configured factory, including the range of its wrapper. */
export interface PluginSourceEntry {
  /** Whether the factory currently executes. */
  enabled: boolean
  /** Start of the replaceable expression. */
  start: number
  /** End of the replaceable expression. */
  end: number
  /** Original factory expression. */
  expression: string
  /** Public snapshot stored in a disabled wrapper. */
  metadata?: DisabledPluginMetadata
}

/** Restricts marker data to bounded, public fields. */
function markerMetadata(value: unknown): DisabledPluginMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid plugin marker')
  const input = value as Record<string, unknown>
  const keys = ['name', 'id', 'displayName', 'description', 'icon', 'logoUrl', 'docsUrl', 'repoUrl'] as const
  const output: Record<string, unknown> = {}
  for (const key of keys) {
    const item = input[key]
    if (item !== undefined && (typeof item !== 'string' || !item || item.length > 2048)) throw new Error('Invalid plugin marker')
    if (item !== undefined) output[key] = item
  }
  if (!output.name || typeof input.client !== 'boolean' || typeof input.frame !== 'boolean') throw new Error('Invalid plugin marker')
  output.client = input.client
  output.frame = input.frame
  if (input.devOnly !== undefined && typeof input.devOnly !== 'boolean') throw new Error('Invalid plugin marker')
  if (input.devOnly) output.devOnly = true
  for (const key of ['logoUrl', 'docsUrl', 'repoUrl']) {
    if (!output[key]) continue
    try {
      const url = new URL(output[key] as string)
      if (!['http:', 'https:'].includes(url.protocol) || (key === 'logoUrl' && url.protocol !== 'https:') || url.username || url.password) delete output[key]
    }
    catch { delete output[key] }
  }
  return output as unknown as DisabledPluginMetadata
}

/** Accepts only an imported direct call, not a dynamic or locally shadowed factory. */
function factory(node: ASTNode, imports: Map<string, string>, bindings: Map<string, unknown>): boolean {
  const call = unwrapNode(node)
  return call.type === 'CallExpression' && call.callee.type === 'Identifier' && imports.has(call.callee.name) && !bindings.has(call.callee.name)
}

/** Parses literal plugin arrays and recognized disabled wrappers without executing code. */
export function analyzePluginSource(code: string): PluginSourceEntry[] {
  const parsed = parseConfigCode(code)
  const config = locateConfigObject(parsed)
  if (!config.object || config.issue) throw new Error('Unsupported plugin config')
  const found = findProperty(config.object, 'plugins')
  if (found.issue || !found.property) throw new Error('Unsupported plugin array')
  const array = unwrapNode(found.property.value)
  if (array.type !== 'ArrayExpression') throw new Error('Unsupported plugin array')
  return array.elements.map((item) => {
    if (!item) throw new Error('Unsupported plugin entry')
    if (factory(item, parsed.imports, parsed.bindings)) return { enabled: true, start: item.start, end: item.end, expression: code.slice(item.start, item.end) }
    if (item.type !== 'SpreadElement') throw new Error('Unsupported plugin entry')
    const conditional = unwrapNode(item.argument)
    if (conditional.type !== 'ConditionalExpression' || conditional.test.type !== 'BooleanLiteral' || conditional.test.value !== false || conditional.consequent.type !== 'ArrayExpression' || conditional.consequent.elements.length !== 1 || conditional.alternate.type !== 'ArrayExpression' || conditional.alternate.elements.length !== 0) throw new Error('Unsupported plugin entry')
    const call = conditional.consequent.elements[0]
    if (!call || !factory(call, parsed.imports, parsed.bindings)) throw new Error('Unsupported plugin entry')
    const prefix = code.slice(conditional.consequent.start + 1, call.start)
    const marker = /^\/\*histoire-plugin:([\w-]+)\*\/$/.exec(prefix)
    if (!marker || marker[1].length > 24_000) throw new Error('Invalid plugin marker')
    let metadata: DisabledPluginMetadata
    try {
      metadata = markerMetadata(JSON.parse(Buffer.from(marker[1], 'base64url').toString('utf8')))
    }
    catch { throw new Error('Invalid plugin marker') }
    return { enabled: false, start: item.start, end: item.end, expression: code.slice(call.start, call.end), metadata }
  })
}

/** Wraps only the selected call and records a minimal public snapshot. */
export function disablePluginEntry(code: string, entry: PluginSourceEntry, metadata: DisabledPluginMetadata): string {
  if (!entry.enabled || code.slice(entry.start, entry.end) !== entry.expression) throw new Error('Plugin entry changed')
  const marker = Buffer.from(JSON.stringify(markerMetadata(metadata))).toString('base64url')
  return `${code.slice(0, entry.start)}...(false ? [/*histoire-plugin:${marker}*/${entry.expression}] : [])${code.slice(entry.end)}`
}

/** Restores precisely the saved expression, retaining its arguments and comments. */
export function enablePluginEntry(code: string, entry: PluginSourceEntry): string {
  if (entry.enabled || !entry.metadata) throw new Error('Plugin entry changed')
  return code.slice(0, entry.start) + entry.expression + code.slice(entry.end)
}
