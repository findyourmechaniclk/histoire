import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { build } from 'esbuild'
import { startMcpProcess } from '../mcp/process.js'
import { runPackageCommand } from '../package-consumer.js'

/** Bundle browser client from installed packages, returning its complete dependency graph. */
export async function bundleConsumerDevframe(root: string) {
  const bundle = await build({
    stdin: { contents: `export {attachDevframe} from '@histoire/devframe/client';export {getDevframeRpcClient} from 'devframe/client'`, resolveDir: root, sourcefile: 'adapter-entry.ts' },
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    metafile: true,
  })
  return { body: bundle.outputFiles[0].text, inputs: Object.keys(bundle.metafile!.inputs) }
}

/** Real installed host and MCP endpoint with independent authenticated fixture principals. */
export async function startConsumerDevframe(root: string, bookUrl: string, hostOrigin: string) {
  const browserToken = randomUUID()
  const aliceToken = randomUUID()
  const bobToken = randomUUID()
  const file = join(root, 'devframe-host.mjs')
  await writeFile(file, `
import {createServer} from 'node:http';
import {mountDevframeHost} from '@histoire/devframe/host';
import {createMcpEndpoint} from '@histoire/devframe/node';
import {toNodeHandler} from '@modelcontextprotocol/node';
const hostOrigin=${JSON.stringify(hostOrigin)},bookUrl=${JSON.stringify(bookUrl)},browserToken=${JSON.stringify(browserToken)};
const principals=new Map();let host,endpoint,dispatch;
const server=createServer((request,response)=>{
  if(request.url==='/health')return void response.end('alive');
  if(request.url==='/nested/histoire/__connection.json'&&request.headers.origin===hostOrigin)response.setHeader('Access-Control-Allow-Origin',hostOrigin);
  if(request.url==='/mcp')return void dispatch(request,response);
  host.nodeMiddleware(request,response,()=>{response.statusCode=404;response.end()});
});
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const origin='http://127.0.0.1:'+server.address().port;
  host=await mountDevframeHost({server,origin,base:'/nested/histoire/',allowedOrigins:[hostOrigin],
    auth:{rpcFunctions:[{name:'anonymous:devframe:auth',type:'action',setup:ctx=>({handler:()=>({isTrusted:ctx.rpc.getCurrentRpcSession()?.meta.isTrusted===true})})}],authorize:(name,session)=>name.startsWith('anonymous:')||session.meta.isTrusted===true,onConnect(connection,session){if(new URL(connection.request?.url??'/',origin).searchParams.get('devframe_auth_token')===browserToken){session.meta.isTrusted=true;principals.set(session.meta.id,'alice')}},printBanner(){}},
    bridge:{identifyPeer:session=>principals.get(session.meta.id),verifyAttachment:(_session,identity,url)=>{if(url!==bookUrl||identity.projectId!=='project')throw new Error('Denied');return {identity,scopes:['inspection']}},isCurrent:()=>true,authorityVersion:()=>0,allowSource:url=>url===bookUrl,authorize:({principal,attachment})=>principal===attachment.principal},
    onPeerDisconnect:(_connection,meta)=>principals.delete(meta.id),
  });
  endpoint=createMcpEndpoint(host.bridge.broker,request=>{const value=request.headers.get('authorization');return value==='Bearer ${aliceToken}'?'alice':value==='Bearer ${bobToken}'?'bob':undefined});
  dispatch=toNodeHandler(endpoint);
  const grant=host.bridge.broker.createGrant({principal:'alice',sourceUrl:bookUrl,scopes:['inspection']});
  console.log('DEVFRAME_READY '+Buffer.from(JSON.stringify({origin,grant:grant.token})).toString('base64'));
  process.once('SIGTERM',async()=>{await endpoint.close();await host.dispose();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()});process.exit(0)});
}catch(error){await endpoint?.close();await host?.dispose();server.close();throw error}
`)
  const process = startMcpProcess([], root, {}, file)
  try {
    const ready = await process.waitFor(/DEVFRAME_READY ([A-Za-z0-9+/=]+)/, 30_000)
    const data = JSON.parse(Buffer.from(ready[1], 'base64').toString('utf8')) as { origin: string, grant: string }
    return { ...data, browserToken, aliceToken, bobToken, close: () => process.close() }
  }
  catch (error) {
    await process.close()
    throw error
  }
}

/** Exercise installed MCP client with both principals and verify the retired attachment. */
export async function inspectConsumerDevframe(root: string, host: { origin: string, aliceToken: string, bobToken: string }, retired = false) {
  const file = join(root, 'devframe-agent.mjs')
  await writeFile(file, `
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
const origin=${JSON.stringify(host.origin)},alice=${JSON.stringify(host.aliceToken)},bob=${JSON.stringify(host.bobToken)},retired=${retired};
async function connect(token){const client=new Client({name:'packed-consumer',version:'1'},{versionNegotiation:{mode:{pin:'2026-07-28'}}});await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{requestInit:{headers:{authorization:'Bearer '+token}}}));return client}
const denied=await fetch(origin+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
if(denied.status!==401)throw new Error('Unauthenticated MCP request was accepted');
const allowed=await connect(alice),other=await connect(bob);
try{
  const resources=(await allowed.listResources()).resources;
  const deniedResources=(await other.listResources()).resources;
  if(deniedResources.length!==0)throw new Error('Other principal discovered an attachment');
  if(retired){if(resources.length!==0)throw new Error('Retired attachment remains visible');}
  else{
    if(resources.length!==1)throw new Error('Expected one authorized attachment');
    const resource=await allowed.readResource({uri:resources[0].uri});
    const attachment=JSON.parse(resource.contents[0].text);
    const args={attachmentId:attachment.attachmentId,target:attachment.owner.target,expectedOwner:attachment.owner,kind:'variant'};
    const result=await allowed.callTool({name:'histoire_inspect_session',arguments:args});
    if(result.isError||result.structuredContent.mode!=='live'||result.structuredContent.state.count!==4||result.structuredContent.owner.target.storyId!=='inspection'||result.structuredContent.owner.target.variantId!=='one')throw new Error('Incorrect live inspection');
    const forbidden=await other.callTool({name:'histoire_inspect_session',arguments:args});
    if(!forbidden.isError)throw new Error('Other principal read an attachment');
  }
  if(await (await fetch(origin+'/health')).text()!=='alive')throw new Error('Caller server unavailable');
}finally{await allowed.close();await other.close()}
`)
  await runPackageCommand(process.execPath, [file], root)
}
