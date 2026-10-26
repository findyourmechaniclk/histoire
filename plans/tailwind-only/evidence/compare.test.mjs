import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- Standalone evidence CLI uses the dependency-free Node test runner.
import { test } from 'node:test'
import { requireHistoire } from './dependencies.mjs'

const { PNG } = requireHistoire('pngjs')

/** Encode a solid fixture; all samples are opaque so alpha cannot hide differences. */
async function fixture(path, width = 2, whitePixels = []) {
  const image = new PNG({ width, height: 2 })
  for (let i = 0; i < width * 2; i++) {
    image.data.fill(whitePixels.includes(i) ? 255 : 0, i * 4, i * 4 + 3)
    image.data[i * 4 + 3] = 255
  }
  await writeFile(path, PNG.sync.write(image))
}

// Public CLI contract: a changed, missing, or resized capture must never look like a pass.
// Known opaque pixels provide an independent oracle; no application styles are asserted.
test('comparison reports exact changes, missing captures and dimension mismatches', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'histoire-compare-'))
  try {
    const before = join(directory, 'before')
    const after = join(directory, 'after')
    const out = join(directory, 'diff')
    await mkdir(before)
    await mkdir(after)
    for (const name of ['same', 'changed', 'missing', 'size']) await fixture(join(before, `${name}.png`))
    await fixture(join(after, 'same.png'))
    await fixture(join(after, 'changed.png'), 2, [0])
    await fixture(join(after, 'size.png'), 3)
    await fixture(join(after, 'added.png'))
    const result = spawnSync(process.execPath, [new URL('./compare.mjs', import.meta.url).pathname, before, after, '--out', out], { encoding: 'utf8' })
    assert.equal(result.status, 1, result.stderr)
    const summary = JSON.parse(await readFile(join(out, 'summary.json'), 'utf8'))
    assert.equal(summary.screens.find(item => item.file === 'same.png').ratio, 0)
    assert.equal(summary.screens.find(item => item.file === 'changed.png').ratio, 0.25)
    assert.equal(summary.screens.find(item => item.file === 'missing.png').status, 'missing-after')
    assert.equal(summary.screens.find(item => item.file === 'added.png').status, 'missing-before')
    assert.equal(summary.screens.find(item => item.file === 'size.png').status, 'dimensions')
    const diff = PNG.sync.read(await readFile(join(out, 'changed.png')))
    assert.equal(diff.width, 2)
    const clean = spawnSync(process.execPath, [new URL('./compare.mjs', import.meta.url).pathname, before, before, '--out', join(directory, 'clean')], { encoding: 'utf8' })
    assert.equal(clean.status, 0, clean.stderr)
    const empty = join(directory, 'empty')
    await mkdir(empty)
    const noImages = spawnSync(process.execPath, [new URL('./compare.mjs', import.meta.url).pathname, empty, empty, '--out', join(directory, 'empty-diff')], { encoding: 'utf8' })
    assert.notEqual(noImages.status, 0, 'Empty capture sets cannot prove visual parity')
    await writeFile(join(before, 'manifest.json'), JSON.stringify({ results: [{ screen: 'unavailable', mode: 'light', status: 'failed' }] }))
    const partial = spawnSync(process.execPath, [new URL('./compare.mjs', import.meta.url).pathname, before, before, '--out', join(directory, 'partial')], { encoding: 'utf8' })
    assert.equal(partial.status, 1, 'Matching PNGs cannot hide failed capture records')
    await writeFile(join(before, 'manifest.json'), JSON.stringify({ results: [{ screen: 'lost', mode: 'light', file: 'lost-light.png', status: 'captured' }] }))
    const lost = spawnSync(process.execPath, [new URL('./compare.mjs', import.meta.url).pathname, before, before, '--out', join(directory, 'lost')], { encoding: 'utf8' })
    assert.equal(lost.status, 1, 'A captured record must still have its PNG')
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
