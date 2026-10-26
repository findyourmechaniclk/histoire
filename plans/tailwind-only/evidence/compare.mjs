import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { requireHistoire } from './dependencies.mjs'

/** Run the compare CLI and report failures through its process exit status. */
async function main() {
  const { PNG } = requireHistoire('pngjs')
  const pixelmatch = requireHistoire('pixelmatch').default
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, threshold: { type: 'string', default: '0.1' } },
  })
  const [before, after] = positionals.map(path => resolve(path))
  if (!before || !after || !values.out || positionals.length !== 2) throw new Error('Usage: node compare.mjs <before> <after> --out <diff-dir> [--threshold 0.1]')
  const out = resolve(values.out)
  if (out === before || out === after) throw new Error('Diff directory must differ from capture directories')
  const threshold = Number(values.threshold)
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Threshold must be between 0 and 1')

  /** List flat PNG captures; manifest and comparison metadata are deliberately ignored. */
  async function captures(directory) {
    return (await readdir(directory)).filter(name => name.endsWith('.png')).sort()
  }

  /** A failed setup has no PNG in either set; never silently count that as parity. */
  async function captureFailures(directory) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'))
      const files = new Set(await captures(directory))
      return manifest.results.flatMap((item) => {
        const status = item.status === 'captured' && !files.has(item.file) ? 'missing-file' : item.status
        return status === 'captured' ? [] : [{ directory, screen: item.screen, mode: item.mode, status }]
      })
    }
    catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  }

  /** Compare dimensions before pixelmatch so a viewport regression becomes a named result. */
  async function compare(file, left, right) {
    if (!left.has(file)) return { file, status: 'missing-before', ratio: null }
    if (!right.has(file)) return { file, status: 'missing-after', ratio: null }
    const a = PNG.sync.read(await readFile(join(before, file)))
    const b = PNG.sync.read(await readFile(join(after, file)))
    if (a.width !== b.width || a.height !== b.height) {
      return { file, status: 'dimensions', before: [a.width, a.height], after: [b.width, b.height], ratio: null }
    }
    const diff = new PNG({ width: a.width, height: a.height })
    const changedPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold, includeAA: true })
    await writeFile(join(out, file), PNG.sync.write(diff))
    return { file, status: changedPixels ? 'changed' : 'same', changedPixels, totalPixels: a.width * a.height, ratio: changedPixels / (a.width * a.height) }
  }

  await mkdir(out, { recursive: true })
  const left = new Set(await captures(before))
  const right = new Set(await captures(after))
  const files = [...new Set([...left, ...right])].sort()
  if (!files.length) throw new Error('No PNG captures found')
  const screens = []
  for (const file of files) screens.push(await compare(file, left, right))
  const failures = [...await captureFailures(before), ...await captureFailures(after)]
  const summary = { before, after, threshold, includeAA: true, screens, captureFailures: failures }
  await writeFile(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  for (const result of screens) process.stdout.write(`${result.file}: ${result.status}${result.ratio === null ? '' : ` ${(result.ratio * 100).toFixed(4)}%`}\n`)
  if (failures.length) process.stderr.write(`${failures.length} unsuccessful capture records; see summary.json\n`)
  process.exitCode = failures.length || screens.some(result => result.status !== 'same') ? 1 : 0
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
