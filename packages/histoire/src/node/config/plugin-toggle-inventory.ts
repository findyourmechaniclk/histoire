import type { Context } from '../context.js'
import type { DisabledPluginMetadata, PluginSourceEntry } from './plugin-toggle-source.js'
import { randomUUID } from 'node:crypto'
import { histoireIconNames } from '@histoire/shared/dist/icons/index.js'
import { configFileHash, hashConfigCode } from './codemod/write.js'
import { getPluginConfigSource, resolveConfigFile } from './load.js'
import { analyzePluginSource } from './plugin-toggle-source.js'

/** Safe row data sent to the workbench. */
export interface PluginInventoryRow extends DisabledPluginMetadata {
  /** Built-in plugins are not editable. */
  builtin: boolean
  /** Effective state in this runtime. */
  enabled: boolean
  /** Generation-scoped identifier for a safely editable entry. */
  toggleId?: string
}

/** Private source evidence for one server generation. */
export interface PluginToggleInventory {
  /** Guarded config file. */
  file: string
  /** Revision of the captured config source. */
  hash: string
  /** Server-only source evaluated by this generation. */
  source: string
  /** Parsed plugin entries in source order. */
  entries: PluginSourceEntry[]
  /** Public rows in resolved order. */
  rows: PluginInventoryRow[]
  /** Rows corresponding to source entries in source order. */
  configured: PluginInventoryRow[]
  /** Server-owned mapping from opaque capabilities to entries. */
  targets: Map<string, { index: number, row: PluginInventoryRow, devOnly?: boolean }>
}

/** Projects resolved plugins and, where safely identified, disabled source entries. */
export async function createPluginInventory(ctx: Context): Promise<{ rows: PluginInventoryRow[], toggle?: PluginToggleInventory }> {
  const rows: PluginInventoryRow[] = (ctx.config.plugins ?? []).map((plugin, index) => ({
    name: plugin.name,
    builtin: plugin.name.startsWith('builtin:'),
    ...(plugin.workbench ? { id: plugin.workbench.id } : {}),
    client: Boolean(plugin.workbench?.client && !(ctx.mode === 'build' && plugin.workbench.devOnly)),
    frame: Boolean(plugin.workbench?.frame && !(ctx.mode === 'build' && plugin.workbench.devOnly)),
    ...ctx.pluginMetadata?.[index],
    enabled: true,
  }))
  const captured = getPluginConfigSource(ctx.config)
  const file = resolveConfigFile(ctx.root, ctx.configFile)
  if (!captured || !file) return { rows }
  try {
    const hash = hashConfigCode(captured.source)
    if (await configFileHash(file, { root: ctx.root }) !== hash) return { rows }
    const entries = analyzePluginSource(captured.source)
    if (entries.filter(entry => entry.enabled).length !== captured.plugins.length) return { rows }
    const matches = captured.plugins.map(plugin => ctx.config.plugins.flatMap((item, index) => item === plugin ? [index] : []))
    if (matches.some(indices => indices.length !== 1) || new Set(matches.map(indices => indices[0])).size !== matches.length) return { rows }
    const configured = entries.map((entry) => {
      if (entry.enabled) return rows[matches.shift()![0]]
      const { devOnly, ...info } = entry.metadata!
      const icon = info.icon && histoireIconNames.includes(info.icon) ? info.icon : undefined
      return { ...info, icon, ...(ctx.mode === 'build' && devOnly ? { client: false, frame: false } : {}), builtin: info.name.startsWith('builtin:'), enabled: false } satisfies PluginInventoryRow
    })
    // Place disabled rows next to their source neighbors without changing resolved active order.
    for (let index = 0; index < configured.length; index++) {
      if (entries[index].enabled) continue
      const next = configured.slice(index + 1).find(row => rows.includes(row))
      const previous = configured.slice(0, index).reverse().find(row => rows.includes(row))
      rows.splice(next ? rows.indexOf(next) : previous ? rows.indexOf(previous) + 1 : rows.length, 0, configured[index])
    }
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1)
    const targets = new Map<string, { index: number, row: PluginInventoryRow, devOnly?: boolean }>()
    if (ctx.mode === 'dev') {
      configured.forEach((row, index) => {
        if (row.builtin || counts.get(row.name) !== 1) return
        const id = randomUUID()
        row.toggleId = id
        const plugin = ctx.config.plugins.find(item => item.name === row.name)
        targets.set(id, { index, row, devOnly: plugin?.workbench?.devOnly })
      })
    }
    return { rows, toggle: { file, hash, source: captured.source, entries, rows, configured, targets } }
  }
  catch { return { rows } }
}
