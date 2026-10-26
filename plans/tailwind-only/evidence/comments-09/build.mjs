import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { getBuiltCaptureIdentity } from '../../../../packages/histoire/dist/node/runtime/catalog/build-metadata.js'

const requireApp = createRequire(new URL('../../../../packages/histoire-app/package.json', import.meta.url))
const { build } = requireApp('vite')
const vue = requireApp('@vitejs/plugin-vue').default
const root = fileURLToPath(new URL('./', import.meta.url))
const outDir = fileURLToPath(new URL('../../../../examples/vue3/.histoire/dist/__comments09/', import.meta.url))
/** Build isolated real components without starting a dev server. */
async function main() {
  const { execFileSync } = await import('node:child_process')
  const app = fileURLToPath(new URL('../../../../packages/histoire-app/', import.meta.url))
  // Each locked fixture build recreates CSS, since another slice may have rebuilt app dist.
  execFileSync(process.execPath, ['../../scripts/build-tailwind.mjs', 'src/app/style/main.css', 'dist/style.css'], { cwd: app, stdio: 'inherit' })
  await build({ configFile: false, root, base: './', plugins: [vue()], resolve: { alias: { 'vue': requireApp.resolve('@histoire/vendors/vue'), ...(process.env.COMMENTS_SOURCE ? { '../../../../packages/histoire-app/src/app/components/comments': process.env.COMMENTS_SOURCE } : {}), '@histoire/controls/vue': fileURLToPath(new URL('../../../../packages/histoire-controls/src/index.ts', import.meta.url)) } }, build: { outDir, emptyOutDir: true }, css: { postcss: app } })
  // Match the static workbench entry: shared defaults first, app utilities last.
  const htmlPath = `${outDir}/index.html`
  const html = await readFile(htmlPath, 'utf8')
  const appLink = /<link\s[^>]*href="\.\/app\.css"[^>]*>/
  const link = html.match(appLink)?.[0]
  if (!link) throw new Error('Missing app stylesheet in comments fixture')
  await writeFile(htmlPath, html.replace(appLink, '').replace('</head>', `${link}\n</head>`))
  await mkdir(outDir, { recursive: true })
  await cp(new URL('../../../../packages/histoire-app/dist/style.css', import.meta.url), `${outDir}/app.css`)
  await cp(new URL('../../../../packages/histoire-controls/src/style/fonts', import.meta.url), `${outDir}/fonts`, { recursive: true })
  // The fixture adds public assets; retain the static host's integrity check with a fresh identity.
  const publicRoot = fileURLToPath(new URL('../../../../examples/vue3/.histoire/dist/', import.meta.url))
  const catalogPath = `${publicRoot}/histoire.json`
  const data = JSON.parse(await readFile(catalogPath, 'utf8'))
  const { capture, ...catalog } = data
  const { buildId: _buildId, ...settings } = capture
  data.capture.buildId = await getBuiltCaptureIdentity(publicRoot, catalog, settings)
  await writeFile(catalogPath, JSON.stringify(data))
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
