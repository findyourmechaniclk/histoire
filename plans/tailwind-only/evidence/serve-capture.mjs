import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

/** Run the serve-capture CLI and report failures through its process exit status. */
async function main() {
  const { values } = parseArgs({ options: {
    out: { type: 'string' },
    port: { type: 'string', default: '4610' },
    project: { type: 'string', default: 'vue3' },
    only: { type: 'string' },
    modes: { type: 'string' },
    base: { type: 'string' },
  } })
  if (!values.out || !['vue3', 'nuxt-ui'].includes(values.project)) throw new Error('Use --out <dir> and --project vue3|nuxt-ui')
  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535 || [6006, 6106].includes(port)) throw new Error('Invalid or reserved port')
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const out = resolve(values.out)
  const base = values.base ?? (values.project === 'nuxt-ui' ? '/_stories/' : '/')
  await mkdir(out, { recursive: true })
  // Refuse an occupied port before starting, so a different server cannot supply captures.
  await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(port, '127.0.0.1', () => probe.close(resolve))
  })
  const log = createWriteStream(resolve(out, 'server.log'))
  // Spawn the CLI directly: its PID owns the server, without a pnpm/shell intermediary.
  // The CLI binds localhost; prefer IPv4 to match capture URLs on IPv6-first hosts.
  const server = spawn(process.execPath, ['--dns-result-order=ipv4first', resolve(root, 'packages/histoire/bin.mjs'), 'preview', '--port', values.port], {
    cwd: resolve(root, `examples/${values.project}`),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.pipe(log)
  server.stderr.pipe(log)
  process.stdout.write(`Started histoire preview PID ${server.pid} on ${port}\n`)
  let serverExited = false
  const serverDone = new Promise((resolve) => {
    server.once('exit', () => {
      serverExited = true
      resolve()
    })
    server.once('error', (error) => {
      serverExited = true
      log.write(`${error.message}\n`)
      resolve()
    })
  })
  let capture
  let captureDone
  let closing

  /** Stop only subprocesses this session acquired, including interrupted captures. */
  async function close() {
    if (closing) return closing
    closing = (async () => {
      if (capture && capture.exitCode === null) capture.kill('SIGTERM')
      if (captureDone) await captureDone.catch(() => {})
      if (!serverExited) server.kill('SIGTERM')
      await Promise.race([serverDone, setTimeout(5000, undefined, { ref: false })])
      if (!serverExited) server.kill('SIGKILL')
      await serverDone
      log.end()
    })()
    return closing
  }

  /** Exit on interruption only after the owned server has released its port. */
  async function interrupted() {
    await close()
    process.exit(130)
  }
  process.once('SIGINT', interrupted)
  process.once('SIGTERM', interrupted)
  try {
    let available = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (serverExited) throw new Error('Server exited during startup; see server.log')
      try {
        const response = await fetch(`http://127.0.0.1:${port}${base}`, { signal: AbortSignal.timeout(1000) })
        if (response.ok) {
          available = true
          break
        }
      }
      catch { /* The owned server has not bound its socket yet. */ }
      await setTimeout(100)
    }
    if (!available) throw new Error('Server did not become ready; see server.log')
    const args = [fileURLToPath(new URL('./capture.mjs', import.meta.url)), '--out', out, '--port', values.port, '--suite', values.project, '--base', base]
    for (const name of ['only', 'modes']) {
      if (values[name]) args.push(`--${name}`, values[name])
    }
    capture = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' })
    captureDone = new Promise((resolve, reject) => {
      capture.once('exit', code => resolve(code ?? 1))
      capture.once('error', reject)
    })
    process.exitCode = await captureDone
  }
  finally {
    await close()
    process.stdout.write(`Stopped histoire preview PID ${server.pid}\n`)
  }
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
