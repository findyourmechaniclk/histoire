import { watch } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const [input, output, ...flags] = process.argv.slice(2)
const require = createRequire(resolve('package.json'))
const postcss = require('postcss')

const { plugins } = require(flags.includes('--peer') ? './postcss.peer.config.cjs' : './postcss.config.cjs')
let pending = Promise.resolve()

/** Run the same PostCSS chain as Vite, including isolation and scope plugins. */
async function build() {
  const from = resolve(input)
  const result = await postcss(plugins).process(await readFile(from, 'utf8'), { from, to: resolve(output) })
  // Both packages copy licensed fonts beside their standalone CSS. V4 rebases
  // imported URLs to source folders; those folders do not ship at that location.
  result.root.walkAtRules('font-face', (face) => {
    face.walkDecls('src', (declaration) => {
      declaration.value = declaration.value.replace(/url\((['"]?)([^)'" ]+)\1\)/g, (value, _quote, url) => {
        const filename = url.match(/(?:^|\/)fonts\/([^/]+)$/)?.[1]
        return url.startsWith('.') && filename ? `url('./fonts/${filename}')` : value
      })
    })
  })
  await mkdir(dirname(resolve(output)), { recursive: true })
  const components = flags.includes('--peer') ? await readFile('dist/peer/index.css', 'utf8') : ''
  await writeFile(output, `${components}\n${result.root.toString()}`)
  process.stdout.write(`Built ${output}\n`)
}

/** Serialize rebuilds so a slower old result cannot overwrite a newer result. */
function rebuild() {
  pending = pending.then(build).catch((error) => {
    console.error(error)
    if (!flags.includes('--watch')) process.exitCode = 1
  })
}

rebuild()
if (flags.includes('--watch')) {
  if (flags.includes('--peer')) watch(resolve('dist/peer/index.css'), rebuild)
  // All three source trees feed app imports or its explicit controls source scan.
  for (const name of ['histoire-app', 'histoire-controls', 'histoire-vue']) {
    watch(resolve('..', name, 'src'), { recursive: true }, rebuild)
  }
}
await pending
