import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { launchEmbedBrowser } from '../../utils/embed/browser.js'
import { bundleConsumerDevframe, inspectConsumerDevframe, startConsumerDevframe } from '../../utils/embed/consumer-devframe.js'
import { createEmbedHosts } from '../../utils/embed/hosts.js'
import { closeMcpFixtures, startMcpProcess } from '../../utils/mcp/process.js'
import { createMcpProjectFixture } from '../../utils/mcp/project.js'
import { createPackedPackageConsumer, fixturePackageVersion, runPackageCommand } from '../../utils/package-consumer.js'

describe('packed inspection consumers', () => {
  it('uses installed browser and Node APIs on the same story and compiles their public types', async () => {
    const fixture = await createMcpProjectFixture()
    const cleanup: (() => Promise<unknown>)[] = [() => fixture.close()]
    try {
      const dependencies = Object.fromEntries(await Promise.all(['vue', 'vite', 'typescript', '@types/node', '@vitejs/plugin-vue', 'playwright'].map(async (name) => {
        const example = ['typescript', '@types/node'].includes(name) ? 'embed-node' : 'vue3'
        return [name, await fixturePackageVersion(name === 'typescript' ? '@typescript/native' : name, example)]
      })))
      const sdkOnly = await createPackedPackageConsumer(join(fixture.root, 'sdk-only'), { packages: ['@histoire/sdk'] })
      await runPackageCommand(process.execPath, ['--input-type=module', '-e', `
delete globalThis.window;delete globalThis.document;
for(const name of ['devframe','@histoire/devframe/client']){try{await import(name);throw new Error('Unexpected optional dependency '+name)}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error}}
const {createHistoireSession}=await import('@histoire/sdk');const session=createHistoireSession({url:'https://book.example/'});await session.dispose();
`], sdkOnly.root)
      const consumer = await createPackedPackageConsumer(fixture.root, { packages: ['@histoire/sdk', 'histoire', '@histoire/plugin-vue', '@histoire/devframe'], dependencies: { ...dependencies, 'devframe': '1.2.2', '@modelcontextprotocol/node': '2.1.0', '@modelcontextprotocol/client': '2.3.1' } })
      const adapter = await bundleConsumerDevframe(consumer.root)
      expect(adapter.inputs.join('\n')).not.toMatch(/(?:node:|@modelcontextprotocol|histoire-devframe\/dist\/node)/)
      const hosts = await createEmbedHosts({ sdkEntry: join(consumer.root, 'node_modules/@histoire/sdk/dist/index.js'), modules: { '/adapter.js': { body: adapter.body } } })
      cleanup.push(() => hosts.close())
      const book = join(consumer.root, 'book')
      await mkdir(book)
      await writeFile(join(book, 'vite.config.ts'), `import vue from '@vitejs/plugin-vue';export default {base:'/book/',plugins:[vue()],server:{host:'127.0.0.1',open:false}}`)
      await writeFile(join(book, 'histoire.config.ts'), `import {HstVue} from '@histoire/plugin-vue';export default {plugins:[HstVue()],storyMatch:['*.story.vue'],collectMaxThreads:1,mcp:false,inspection:{enabled:true,allowedOrigins:[${JSON.stringify(hosts.hostOrigin)}]},embed:{enabled:true,allowedOrigins:[${JSON.stringify(hosts.hostOrigin)}]}}`)
      await writeFile(join(book, 'Inspection.story.vue'), `<script setup>import {onMounted} from 'vue';function initial(){return {count:3}};onMounted(()=>console.warn('packed inspection warning'))</script><template><Story id="inspection" title="Inspection"><Variant id="one" :init-state="initial"><template #default="{state}"><button data-testid="counter" @click="state.count++">Count {{state.count}}</button></template></Variant></Story></template>`)
      await compileInspectionTypes(consumer.root)
      await writeFile(join(consumer.root, 'inspection-host.mjs'), `
import {createHistoireProject} from 'histoire/node';
const project=await createHistoireProject({root:${JSON.stringify(book)}});
try {
  const dev=await project.startDev({host:'127.0.0.1',port:0});await dev.ready;
  const target={source:'dev',storyId:'inspection',variantId:'one'};
  const variant=await project.inspect.variant(target);
  const dom=await project.inspect.dom({...target,selector:'[data-testid=counter]'});
  const aria=await project.inspect.aria({...target,selector:'[data-testid=counter]'});
  const diagnostics=await project.inspect.diagnostics(target);
  console.log('INSPECTION_RESULT '+Buffer.from(JSON.stringify({url:dev.url,variant,dom,aria,diagnostics})).toString('base64'));
  process.once('SIGTERM',async()=>{await project.close();process.exit(0)});
} catch(error) { await project.close();throw error }
`)
      const child = startMcpProcess([], consumer.root, {}, join(consumer.root, 'inspection-host.mjs'))
      cleanup.push(() => child.close())
      const match = await child.waitFor(/INSPECTION_RESULT ([A-Za-z0-9+/=]+)/, 180_000)
      const result = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'))
      expect(result.variant).toMatchObject({ mode: 'isolated', inspection: 'variant', state: { count: 3 } })
      expect(result.dom).toMatchObject({ mode: 'isolated', inspection: 'dom', matched: true, nodes: [{ tag: 'button', text: 'Count 3' }] })
      expect(result.aria).toMatchObject({ mode: 'isolated', inspection: 'accessibility' })
      expect(result.aria.snapshot).toContain('button "Count 3"')
      expect(result.diagnostics).toMatchObject({ mode: 'isolated', inspection: 'diagnostics' })
      expect(result.diagnostics.entries).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'console', message: 'packed inspection warning' })]))
      const devframe = await startConsumerDevframe(consumer.root, result.url, hosts.hostOrigin)
      cleanup.push(() => devframe.close())
      const browser = await launchEmbedBrowser()
      cleanup.push(() => browser.close())
      const page = await browser.newPage()
      await page.goto(`${hosts.hostOrigin}/host.html`)
      await page.evaluate(`(async()=>{const {createHistoireSession}=await import('/sdk.js');window.session=createHistoireSession({url:${JSON.stringify(result.url)}});await session.connect();await session.selection.select({storyId:'inspection',variantId:'one'});window.primary=session.mount(document.querySelector('#mount'),{surface:'preview'});await primary.ready})()`)
      const frame = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
      await page.evaluate(`(async()=>{const {getDevframeRpcClient,attachDevframe}=await import('/adapter.js');window.connection=await getDevframeRpcClient({baseURL:${JSON.stringify(`${devframe.origin}/nested/histoire/`)},authToken:${JSON.stringify(devframe.browserToken)},webmcp:false,simpleAuth:false,otpParam:false,callTimeout:3000});await connection.ensureTrusted();window.attachment=await attachDevframe({session,connection,grant:${JSON.stringify(devframe.grant)},projectId:'project',scopes:['inspection']})})()`)
      await frame.getByTestId('counter').click()
      await inspectConsumerDevframe(consumer.root, devframe)
      expect(await page.evaluate('session.inspect.variant()')).toMatchObject({ mode: 'live', inspection: 'variant', state: { count: 4 }, owner: { target: { storyId: 'inspection', variantId: 'one' } } })
      expect(await page.evaluate('session.inspect.dom({selector:"[data-testid=counter]"})')).toMatchObject({ mode: 'live', inspection: 'dom', matched: true, nodes: [{ tag: 'button', text: 'Count 4' }] })
      const point = await frame.getByTestId('counter').evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      })
      const picked = await page.evaluate(`session.inspect.pick(${JSON.stringify(point)})`)
      expect(picked).toMatchObject({ matched: true, owner: { target: { storyId: 'inspection', variantId: 'one' } } })
      const lease = await page.evaluate(`session.inspect.highlightLease({selector:${JSON.stringify(picked.selector)},expectedOwner:${JSON.stringify(picked.owner)}})`)
      const cleared = await page.evaluate(`session.inspect.clearHighlight({target:${JSON.stringify(lease.owner.target)},expectedOwner:${JSON.stringify(lease.owner)},leaseId:${JSON.stringify(lease.leaseId)}})`)
      expect(cleared).toMatchObject({ cleared: true, owner: picked.owner })
      const live = await page.evaluate('session.inspect.variant()')
      await writeFile(join(consumer.root, 'live-result.json'), JSON.stringify(live))
      await runPackageCommand(process.execPath, ['--input-type=module', '-e', `
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
delete globalThis.window;delete globalThis.document;
const {attachDevframe}=await import('@histoire/devframe/client');
const {createDevframeBridge,createMcpEndpoint}=await import('@histoire/devframe/node');
const {createInspectionReport}=await import('@histoire/devframe/report');
const {mountDevframeHost}=await import('@histoire/devframe/host');
if(!attachDevframe||!createDevframeBridge||!createMcpEndpoint||!mountDevframeHost)throw new Error('Missing adapter entry');
const result=JSON.parse(await readFile('live-result.json','utf8'));
const report=createInspectionReport({results:[result]});
if(report.data.entries[0].inspection!=='variant'||report.data.entries[0].stateFields!==Object.keys(result.state).length||JSON.stringify(report.data).includes('\"count\"')||report.html.includes('Count 4'))throw new Error('Incorrect historical report');
let host;
const server=createServer((request,response)=>{
  if(request.url==='/health')return void response.end('alive');
  host?.nodeMiddleware(request,response,()=>{response.statusCode=404;response.end()});
});
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const origin='http://127.0.0.1:'+server.address().port;
  host=await mountDevframeHost({server,base:'/nested/histoire/',origin,auth:{rpcFunctions:[],authorize:()=>false,onConnect(){},printBanner(){}},bridge:{identifyPeer:()=>undefined,verifyAttachment:(_peer,identity)=>({identity,scopes:[]}),isCurrent:()=>false,authorityVersion:()=>0,allowSource:()=>false,authorize:()=>false}});
  if((await fetch(origin+'/nested/histoire/__connection.json')).status!==200)throw new Error('Host metadata unavailable');
  await Promise.all([host.dispose(),host.dispose()]);
  if((await fetch(origin+'/nested/histoire/__connection.json')).status!==404)throw new Error('Host metadata still mounted');
  if(await (await fetch(origin+'/health')).text()!=='alive')throw new Error('Caller server closed');
}finally{
  await host?.dispose();
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()});
}
`], consumer.root)
      await page.evaluate('(async()=>{await attachment.dispose();connection.close();await session.dispose()})()')
      await inspectConsumerDevframe(consumer.root, devframe, true)
    }
    finally { await closeMcpFixtures(cleanup) }
  }, 600_000)
})

/** Compile installed declarations using browser and Node resolution contracts. */
async function compileInspectionTypes(root: string) {
  await writeFile(join(root, 'inspection-types.mts'), `
import {createHistoireSession} from '@histoire/sdk';
import {createHistoireProject} from 'histoire/node';
import {attachDevframe} from '@histoire/devframe/client';
import {createDevframeBridge,createMcpEndpoint} from '@histoire/devframe/node';
import {createInspectionReport} from '@histoire/devframe/report';
import {mountDevframeHost,type DevframeHostOptions} from '@histoire/devframe/host';
async function inspect(){
  const session=createHistoireSession({url:'https://book.example/'});
  const live=await session.inspect.variant({target:{storyId:'story',variantId:'variant'},signal:new AbortController().signal});
  const liveMode:'live'|'isolated'=live.mode;
  const dom=await session.inspect.dom({selector:'button',maxNodes:3,maxDepth:1,expectedOwner:live.owner});
  const picked=await session.inspect.pick({x:1,y:2,expectedOwner:live.owner});
  if(picked.matched){const lease=await session.inspect.highlightLease({selector:picked.selector,expectedOwner:picked.owner});await session.inspect.clearHighlight({target:lease.owner.target,expectedOwner:lease.owner,leaseId:lease.leaseId})}
  const report=createInspectionReport({results:[live,dom]});
  const hostOptions:DevframeHostOptions|undefined=undefined;
  void hostOptions;void mountDevframeHost;void report;void attachDevframe;void createDevframeBridge;void createMcpEndpoint;
  // @ts-expect-error inspection results are readonly
  dom.nodes[0].tag='input';
  const project=await createHistoireProject({root:process.cwd()});
  const target={source:'dev' as const,storyId:'story',variantId:'variant'};
  const variant=await project.inspect.variant(target);
  const mode:'isolated'=variant.mode;
  await project.inspect.dom({...target,selector:'button'});
  await project.inspect.aria({...target,maxCharacters:100});
  await project.inspect.diagnostics({...target,observationMs:100});
  // @ts-expect-error source is explicit and required
  await project.inspect.variant({storyId:'story',variantId:'variant'});
  // @ts-expect-error unknown source cannot silently fall back
  await project.inspect.dom({...target,source:'other'});
  void liveMode;void mode;
}
void inspect;
`)
  for (const resolution of ['Node16', 'NodeNext', 'Bundler']) {
    const configuration = `tsconfig.inspection-${resolution}.json`
    await writeFile(join(root, configuration), JSON.stringify({ compilerOptions: { target: 'ES2022', module: resolution === 'Bundler' ? 'ESNext' : resolution, moduleResolution: resolution, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['node'], strict: true, noEmit: true, skipLibCheck: true }, include: ['inspection-types.mts'] }))
    await runPackageCommand('pnpm', ['exec', 'tsc', '--project', configuration], root)
  }
}
