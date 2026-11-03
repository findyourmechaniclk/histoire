import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { startMcpProcess } from '../../../histoire/src/node/__tests__/utils/mcp/process.js'
import { createPackedPackageConsumer } from '../../../histoire/src/node/__tests__/utils/package-consumer.js'

// Public tarball is installed outside workspace; source-relative resolution and
// omitted browser assets must fail this actual consumer, not a manifest snapshot.
it('serves packaged browser assets and runtime from unrelated installed consumer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'histoire-proxy-package-'))
  let process: ReturnType<typeof startMcpProcess> | undefined
  try {
    const consumer = await createPackedPackageConsumer(directory, { packages: ['@histoire/dev-proxy'] })
    await writeFile(join(consumer.root, 'runtime.mjs'), await readFile(new URL('./fixtures/runtime.mjs', import.meta.url)))
    await writeFile(join(consumer.root, 'histoire.config.ts'), JSON.stringify({ value: 'packed runtime' }))
    await writeFile(join(consumer.root, 'serve.mjs'), `
      import {startDevProxy} from '@histoire/dev-proxy';
      const proxy=await startDevProxy({port:0,host:'127.0.0.1',runtime:new URL('./runtime.mjs',import.meta.url)});
      console.log('Histoire: '+proxy.url);
      process.once('SIGTERM',()=>proxy.close().catch(error=>{console.error(error);process.exitCode=1}));
    `)
    process = startMcpProcess([], consumer.root, {}, join(consumer.root, 'serve.mjs'))
    const url = (await process.waitFor(/Histoire: (http\S+)/))[1]
    const lifecycle = await fetch(`${url}__histoire/dev/lifecycle.js`)
    expect(lifecycle.status).toBe(200)
    const lifecycleSource = await lifecycle.text()
    expect(lifecycleSource).toContain('EventSource')
    // Entries share code through bundler chunks; an unserved chunk breaks every startup script.
    for (const chunk of lifecycleSource.matchAll(/from "\.\/(chunks\/[^"]+)"/g)) {
      expect((await fetch(`${url}__histoire/dev/${chunk[1]}`)).status).toBe(200)
    }
    await expect.poll(async () => (await fetch(url)).text()).toContain('packed runtime')
  }
  finally {
    await process?.close()
    await rm(directory, { recursive: true, force: true })
  }
}, 120_000)
