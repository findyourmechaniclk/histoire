import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createMcpCliProject } from '../utils/mcp/cli-project.js'
import { assertMcpProcessReleased, startMcpProcess } from '../utils/mcp/process.js'

// Real installed-equivalent CLI/config/Vite/processes. External HTTP gate holds
// configuration and cleanup so early response and replacement ordering have
// independent public oracles; no lifecycle/controller module is substituted.
it('binds before config finishes, restarts only after full winddown, and recovers bad config', async () => {
  const fixture = await createMcpCliProject()
  let releaseConfig: (() => void) | undefined
  let releaseCleanup: (() => void) | undefined
  let cleanupEntered = false
  const gate = createServer((request, response) => {
    if (request.url === '/config') {
      releaseConfig = () => response.end('go')
    }
    else {
      cleanupEntered = true
      releaseCleanup = () => response.end('closed')
    }
  })
  await new Promise<void>((resolve, reject) => {
    gate.once('error', reject)
    gate.listen(0, '127.0.0.1', resolve)
  })
  const origin = `http://127.0.0.1:${(gate.address() as { port: number }).port}`
  const file = join(fixture.root, 'custom config.ts')
  const dependency = join(fixture.root, 'label.ts')
  await writeFile(dependency, 'export const suffix = "initial"')
  const pidFile = join(fixture.root, 'runtime-pid')
  const cpuStarted = join(fixture.root, 'cpu-started')
  const cpuRelease = join(fixture.root, 'cpu-release')
  const config = (label: string, block = false) => `
    import {writeFile} from 'node:fs/promises';import {existsSync,writeFileSync} from 'node:fs'; import {HstVue} from '@histoire/plugin-vue';import {suffix} from './label';
    ${block ? `await fetch('${origin}/config');writeFileSync(${JSON.stringify(cpuStarted)},'running');while(!existsSync(${JSON.stringify(cpuRelease)})) { /* Hold runtime CPU until external test releases it. */ }` : ''}
    await writeFile(${JSON.stringify(pidFile)},String(process.pid));
    export default {mcp:false,plugins:[HstVue(),{name:'winddown',onDev(_api,onCleanup){onCleanup(()=>fetch('${origin}/cleanup'))}}],storyMatch:['*.story.vue'],theme:{title:${JSON.stringify(label)}+suffix}};
  `
  await writeFile(file, config('First', true))
  const child = startMcpProcess(['dev', '--port', '0', '--host', '127.0.0.1', '--config', 'custom config.ts', '--no-mcp'], fixture.root)
  let url = ''
  try {
    url = (await child.waitFor(/Histoire: (http\S+)/))[1]
    const firstResponse = await fetch(url, { headers: { accept: 'text/html' } })
    expect(firstResponse.status).toBe(200)
    expect(await firstResponse.text()).toContain('Starting Histoire')
    await expect.poll(() => typeof releaseConfig, { timeout: 30_000 }).toBe('function')
    expect((await fetch(`${url}module.js`)).status).toBe(503)
    releaseConfig!()
    await expect.poll(() => readFile(cpuStarted, 'utf8'), { timeout: 30_000 }).toBe('running')
    const duringCpu = await fetch(url, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(5000) })
    expect(await duringCpu.text()).toContain('Starting Histoire')
    await writeFile(cpuRelease, 'continue')
    await expect.poll(async () => (await fetch(url)).text(), { timeout: 60_000 }).toContain('data-histoire-generation')
    const firstPid = Number(await readFile(pidFile, 'utf8'))
    expect(firstPid).not.toBe(child.child.pid)
    const hmr = await (await fetch(`${url}@vite/client`)).text()
    expect(hmr).toContain(String(new URL(url).port))
    const token = /const wsToken = "([^"]+)"/.exec(hmr)![1]
    const socket = new WebSocket(`${url.replace('http:', 'ws:')}?token=${token}`, 'vite-hmr')
    const connected = new Promise<string>((resolve, reject) => {
      socket.addEventListener('message', event => resolve(String(event.data)), { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    expect(JSON.parse(await connected).type).toBe('connected')
    socket.close()
    await writeFile(file, config('Second'))
    await expect.poll(() => cleanupEntered).toBe(true)
    expect(Number(await readFile(pidFile, 'utf8'))).toBe(firstPid)
    expect(await (await fetch(url, { headers: { accept: 'text/html' } })).text()).toContain('Restarting Histoire')
    releaseCleanup!()
    await expect.poll(async () => Number(await readFile(pidFile, 'utf8')), { timeout: 30_000 }).not.toBe(firstPid)
    expect(() => process.kill(firstPid, 0)).toThrow()
    await expect.poll(async () => (await fetch(url)).text(), { timeout: 60_000 }).toContain('data-histoire-generation')
    const secondPid = Number(await readFile(pidFile, 'utf8'))
    cleanupEntered = false
    releaseCleanup = undefined
    await writeFile(dependency, 'export const suffix = invalid syntax')
    await expect.poll(() => cleanupEntered).toBe(true)
    releaseCleanup!()
    await expect.poll(async () => (await fetch(url)).text(), { timeout: 30_000 }).toContain('Histoire failed to start')
    await writeFile(dependency, 'export const suffix = "updated"')
    await expect.poll(async () => (await fetch(url)).text(), { timeout: 60_000 }).toContain('data-histoire-generation')
    expect(Number(await readFile(pidFile, 'utf8'))).not.toBe(secondPid)
    expect(await (await fetch(`${url}@id/__x00__virtual:$histoire-config`)).text()).toContain('Secondupdated')
    cleanupEntered = false
    releaseCleanup = undefined
    await writeFile(file, 'export default { invalid syntax')
    await expect.poll(() => cleanupEntered).toBe(true)
    await expect.poll(() => typeof releaseCleanup).toBe('function')
    releaseCleanup!()
    await expect.poll(async () => (await fetch(url)).text(), { timeout: 30_000 }).toContain('Histoire failed to start')
    await writeFile(file, config('Recovered'))
    await expect.poll(async () => (await fetch(url)).text(), { timeout: 60_000 }).toContain('data-histoire-generation')
  }
  finally {
    releaseConfig?.()
    await writeFile(cpuRelease, 'continue')
    // Signal shutdown may acquire another cleanup gate after its caller began.
    const finish = setInterval(() => releaseCleanup?.(), 20)
    try {
      await child.close()
    }
    finally {
      clearInterval(finish)
      gate.closeAllConnections()
      await new Promise<void>(resolve => gate.close(() => resolve()))
      await fixture.close()
    }
  }
  await assertMcpProcessReleased(child.child, url)
}, 180_000)
