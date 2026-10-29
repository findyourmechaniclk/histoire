import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'

let server
let settings
let descendant
/** Test peer obeys actual process protocol and serves its PID as observable identity. */
async function start(message) {
  const config = JSON.parse(await readFile(join(process.cwd(), 'histoire.config.ts'), 'utf8'))
  settings = config
  if (config.gate) await fetch(config.gate)
  if (config.descendant) {
    const peer = spawn(process.execPath, ['--input-type=module', '-e', `import{createServer}from'node:http';const server=createServer((_,response)=>response.end('alive'));server.listen(0,'127.0.0.1',()=>process.send(server.address().port));setInterval(()=>{},1000)`], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    descendant = await new Promise(resolve => peer.once('message', port => resolve(`http://127.0.0.1:${port}`)))
  }
  server = createServer((request, response) => {
    if (request.url === '/echo') {
      request.pipe(response)
      return
    }
    if (request.url === '/stream') {
      response.write('first chunk')
      response.once('close', () => {
        void writeFile(join(process.cwd(), 'stream-closed'), 'closed')
      })
      return
    }
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ value: config.value, pid: process.pid, descendant }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  process.send({ type: 'ready', generation: message.generation, target: `http://127.0.0.1:${server.address().port}`, base: '/' })
}
process.on('message', (message) => {
  if (message.type === 'start') void start(message).catch(error => process.send({ type: 'failed', generation: message.generation, error: error.message }))
  if (message.type === 'shutdown') {
    if (settings?.hang) return
    server?.closeAllConnections()
    server?.close()
    process.disconnect()
  }
})
