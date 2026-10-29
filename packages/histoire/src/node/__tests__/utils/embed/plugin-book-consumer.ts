import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { startMcpProcess } from '../mcp/process.js'

/** Story framework of installed plugin consumer. */
export type PluginBookFramework = 'vue' | 'react' | 'svelte' | 'vanilla'

/** Variant with known findings: an image without alt text and a button below `minTargetSize`. */
const STORIES: Record<PluginBookFramework, { file: string, source: string }> = {
  svelte: {
    file: 'Audit.story.svelte',
    source: '<script>export let Hst</script><Hst.Story id="audit" title="Audit"><Hst.Variant id="issues" title="Issues"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" /></Hst.Variant></Hst.Story>',
  },
  vanilla: {
    file: 'Audit.story.js',
    source: `export default { id: 'audit', title: 'Audit', variants: [{ id: 'issues', title: 'Issues', onMount({el}) { el.append(document.createElement('img')) } }] }`,
  },
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

/** Write isolated installed-plugin consumer book with shared story fixtures. */
export async function writePluginBook(root: string, framework: PluginBookFramework, routerMode: 'history' | 'hash', pluginImport: string, pluginCall: string) {
  const book = join(root, 'book')
  await mkdir(book, { recursive: true })
  const story = STORIES[framework]
  await writeFile(join(book, story.file), story.source)
  const vite = framework === 'vanilla' ? '' : `import {${framework === 'svelte' ? 'svelte' : `default as ${framework}`}} from '${framework === 'svelte' ? '@sveltejs/vite-plugin-svelte' : `@vitejs/plugin-${framework}`}'`
  await writeFile(join(book, 'vite.config.ts'), `${vite};export default {plugins:[${framework === 'vanilla' ? '' : `${framework}()`}],css:{postcss:{plugins:[]}}}`)
  const support = framework === 'vanilla' ? '' : `import {${{ vue: 'HstVue', react: 'HstReact', svelte: 'HstSvelte' }[framework]} as support} from '@histoire/plugin-${framework}'`
  await writeFile(join(book, 'histoire.config.ts'), `${support};${pluginImport}
export default {plugins:[${framework === 'vanilla' ? '' : 'support(),'}${pluginCall}],storyMatch:[${JSON.stringify(story.file)}],collectMaxThreads:1,mcp:false,routerMode:${JSON.stringify(routerMode)}}`)
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
export async function servePluginBook(root: string, book: string, mode: 'dev' | 'static') {
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
