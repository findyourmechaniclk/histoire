import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from 'vitest'
import { startMcpProcess } from '../mcp/process.js'
import { createPackedPackageConsumer, fixturePackageVersion } from '../package-consumer.js'

/** Story frameworks of the reference plugin consumer books. */
export type ReferenceBookFramework = 'vue' | 'react'

/** Variant with known findings: an image without alt text and a button below `minTargetSize`. */
const STORIES: Record<ReferenceBookFramework, { file: string, source: string }> = {
  vue: {
    file: 'Audit.story.vue',
    source: '<template><Story id="audit" title="Audit"><Variant id="issues" title="Issues"><button>Save</button><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></Variant></Story></template>\n',
  },
  react: {
    file: 'Audit.story.tsx',
    source: `import { Story, Variant } from '@histoire/plugin-react'
export default function AuditStory() {
  return <Story id="audit" title="Audit"><Variant id="issues" title="Issues"><button>Save</button><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" /></Variant></Story>
}
`,
  },
}

/**
 * Installs the packed reference plugin with packed Histoire into a clean project, never through
 * workspace links. The React project installs no `vue`: Vue views run on the workbench's Vue.
 * @param directory Owned temporary directory.
 * @param framework Story framework of the book.
 */
export async function createReferencePluginConsumer(directory: string, framework: ReferenceBookFramework) {
  const support = framework === 'vue' ? '@histoire/plugin-vue' : '@histoire/plugin-react'
  const external = framework === 'vue' ? ['vue', '@vitejs/plugin-vue'] : ['react', 'react-dom', '@vitejs/plugin-react']
  const example = framework === 'vue' ? 'vue3' : 'react'
  const dependencies = Object.fromEntries(await Promise.all([...external, 'vite'].map(async name => [name, await fixturePackageVersion(name, example)])))
  return createPackedPackageConsumer(directory, { packages: ['histoire', support, 'histoire-example-plugin-reference'], dependencies })
}

/**
 * Writes a book using the reference plugin with a UI variant of another framework.
 * @param root Consumer root.
 * @param framework Story framework.
 * @param ui Reference plugin UI variant.
 * @param routerMode Workbench router mode.
 */
export async function writeReferenceBook(root: string, framework: ReferenceBookFramework, ui: string, routerMode: 'history' | 'hash') {
  const book = join(root, 'book')
  await mkdir(book, { recursive: true })
  const story = STORIES[framework]
  await writeFile(join(book, story.file), story.source)
  const vite = framework === 'vue' ? `import vue from '@vitejs/plugin-vue'` : `import react from '@vitejs/plugin-react'`
  await writeFile(join(book, 'vite.config.ts'), `${vite};export default {plugins:[${framework}()],css:{postcss:{plugins:[]}}}`)
  const support = framework === 'vue' ? `import {HstVue as support} from '@histoire/plugin-vue'` : `import {HstReact as support} from '@histoire/plugin-react'`
  await writeFile(join(book, 'histoire.config.ts'), `${support};import {referencePlugin} from 'histoire-example-plugin-reference'
export default {plugins:[support(),referencePlugin({ui:${JSON.stringify(ui)},minTargetSize:1000})],storyMatch:[${JSON.stringify(story.file)}],collectMaxThreads:1,mcp:false,routerMode:${JSON.stringify(routerMode)}}`)
  // Installed `histoire/node` only; the Node SDK owns dev, build and the static server.
  await writeFile(join(root, 'serve-book.mjs'), `import {createHistoireProject} from 'histoire/node'
const project=await createHistoireProject({root:process.argv[3]})
let url
if(process.argv[2]==='static'){await project.build();const server=await project.preview({host:'127.0.0.1',port:0});await server.ready;url=server.url}
else{const dev=await project.startDev({host:'127.0.0.1',port:0});await dev.ready;url=dev.url}
console.log('Histoire: '+url)
process.once('SIGTERM',()=>project.close().then(()=>process.exit(0),()=>process.exit(1)))
`)
  return book
}

/**
 * Serves the book from the consumer root through installed packages.
 * @param root Consumer root.
 * @param book Book directory.
 * @param mode Dev server or static build.
 */
export async function serveReferenceBook(root: string, book: string, mode: 'dev' | 'static') {
  const process = startMcpProcess([mode, book], root, {}, join(root, 'serve-book.mjs'))
  try {
    const ready = await process.waitFor(/Histoire: (http\S+)/, 300_000)
    return { url: ready[1].endsWith('/') ? ready[1] : `${ready[1]}/`, close: process.close, output: process.output }
  }
  catch (error) {
    await process.close()
    throw error
  }
}

/**
 * Checks the Audit tab shows both findings: the frame plugin attached, reported over its channel,
 * and received `minTargetSize` from the descriptor options.
 * @param page Playwright page on the variant with `?tab=reference:audit`.
 * @param errors Page errors collected so far, shown when the tab never reports.
 */
export async function expectAuditFindings(page: any, errors: readonly string[]) {
  const panel = page.getByRole('tabpanel')
  try {
    await expect.poll(() => panel.textContent(), { timeout: 60_000 }).toContain('2 issues')
  }
  catch (error) {
    throw new Error(`Audit tab never reported. Page errors: ${errors.join('\n') || 'none'}`, { cause: error })
  }
  const text = await panel.textContent()
  expect(text).toContain('Missing alt')
  expect(text).toContain('below 1000 px')
}
