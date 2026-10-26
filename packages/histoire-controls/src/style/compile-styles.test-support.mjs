import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

/**
 * Compile the real package entry and PostCSS pipeline with explicit test candidates.
 * @param {string} packageName Workspace package folder.
 * @param {string} entry CSS entry relative to that package.
 * @param {string[]} candidates Test-only utilities, kept out of the source scan.
 */
export async function compileStyles(packageName, entry, candidates) {
  const packageUrl = new URL(`../../../${packageName}/`, import.meta.url)
  const require = createRequire(new URL('package.json', packageUrl))
  const config = require(entry.endsWith('/peer.css') ? './postcss.peer.config.cjs' : './postcss.config.cjs')
  const from = fileURLToPath(new URL(entry, packageUrl))
  const source = await readFile(from, 'utf8')
  return postcss(config.plugins).process(`${source}\n@source inline("${candidates.join(' ')}");`, { from })
}
