import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { normalize, resolve } from 'pathe'
import { describe, expect, it } from 'vitest'

/** App stylesheets permitted by plans/tailwind-only/exceptions.md. */
const allowedStyles = [
  'app/style/controls.css',
  'app/style/density.css',
  'app/style/document.pcss',
  'app/style/fonts.pcss',
  'app/style/main.css',
  'app/style/theme.css',
  'app/style/tokens.pcss',
  'embed/document.css',
]
/** Absolute authored source tree, excluding documentation and build output. */
const sourceRoot = fileURLToPath(new URL('../../../../histoire-app/src/', import.meta.url))
/** Standalone pre-runtime document cannot consume workbench's Tailwind bundle. */
const runtimeStyleExceptions = ['packages/histoire-dev-proxy/src/client/styles.ts']

describe('app styling boundaries', async () => {
  const paths = (await readdir(sourceRoot, { recursive: true })).map(path => normalize(path))

  it('documents standalone runtime styles outside workbench stylesheet inventory', async () => {
    const root = fileURLToPath(new URL('../../../../../', import.meta.url))
    const exceptions = await readFile(resolve(root, 'plans/tailwind-only/exceptions.md'), 'utf8')
    for (const path of runtimeStyleExceptions) {
      expect(exceptions).toContain(path)
      expect(await readFile(resolve(root, path), 'utf8')).toBeTruthy()
    }
  })

  it('keeps global stylesheets aligned with documented exceptions', () => {
    const styles = paths.filter(path => /\.(?:css|pcss)$/.test(path))
    expect(styles.sort()).toEqual(allowedStyles)
  })

  it('uses utilities instead of Vue style blocks', async () => {
    const violations = []
    for (const path of paths.filter(path => path.endsWith('.vue'))) {
      if (/<style\b/i.test(await readFile(resolve(sourceRoot, path), 'utf8'))) violations.push(path)
    }
    expect(violations).toEqual([])
  })

  it('never reaches into child styling with deep selectors', async () => {
    const violations = []
    for (const path of paths.filter(path => /\.(?:vue|[cm]?[jt]sx?|p?css)$/.test(path))) {
      if ((await readFile(resolve(sourceRoot, path), 'utf8')).includes(':deep(')) violations.push(path)
    }
    expect(violations).toEqual([])
  })
})
