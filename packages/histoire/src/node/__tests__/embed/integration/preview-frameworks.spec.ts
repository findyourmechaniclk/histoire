import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHistoireProject } from 'histoire/node'
import { describe, expect, it } from 'vitest'
import { launchEmbedBrowser } from '../../utils/embed/browser.js'
import { createEmbedHosts } from '../../utils/embed/hosts.js'
import { attemptEmbedPrimary } from '../../utils/embed/primary-session.js'
import { createMcpFrameworkProject } from '../../utils/mcp/framework-project.js'

describe('isolated framework preview engines', () => {
  it('runs Nuxt setup against each actual variant app without sharing useState', async () => {
    const fixture = await createMcpFrameworkProject('nuxt4')
    const hosts = await createEmbedHosts()
    const browser = await launchEmbedBrowser()
    const project = await createHistoireProject({ root: fixture.root })
    const page = await browser.newPage()
    try {
      await writeFile(join(fixture.root, 'histoire.config.ts'), `import {HstVue} from '@histoire/plugin-vue';import {HstNuxt} from '@histoire/plugin-nuxt';export default { plugins:[HstVue(),HstNuxt()],setupFile:'./setup.ts',storyMatch:['app/components/Isolated.story.vue'],collectMaxThreads:1,mcp:false,embed:{enabled:true,allowedOrigins:[${JSON.stringify(hosts.hostOrigin)}]} }`)
      await writeFile(join(fixture.root, 'setup.ts'), `export function setupVue3({app,variant}){if(variant&&typeof window!=='undefined'){window.__VARIANT_NUXT__??=[];window.__VARIANT_NUXT__.push({variant:variant.id,meta:variant.meta.owner,nuxt:app.$nuxt})}}`)
      await writeFile(join(fixture.root, 'app/components/Isolated.story.vue'), `<script setup>const count=useState('same-key',()=>0);const config=useRuntimeConfig()</script><template><Story id="nuxt-isolated" :layout="{type:'grid'}"><Variant id="one" :meta="{owner:'one'}"><button @click="count++">one:{{count}}</button><span>{{config.public.configFromNuxt}}:{{config.app.baseURL}}</span></Variant><Variant id="two" :meta="{owner:'two'}"><button @click="count++">two:{{count}}</button><span>{{config.public.configFromNuxt}}:{{config.app.baseURL}}</span></Variant></Story></template>`)
      const dev = await project.startDev({ host: '127.0.0.1', port: 0 })
      await dev.ready
      await page.goto(`${hosts.hostOrigin}/host.html`)
      const cold = await attemptEmbedPrimary(page, dev.url, { storyId: 'nuxt-isolated', variantId: 'one' }, 'preview')
      console.warn('Nuxt initial mount:', cold ? 'optimizer disconnected source; explicit caller reconnect' : 'ready')
      if (cold) {
        // Explicit caller recovery after Vite optimizer reload; SDK never replays mount/edits.
        expect(cold).toEqual({ code: 'NOT_CONNECTED', status: 'disconnected', stale: true })
        await page.evaluate('session.dispose()')
        expect(await attemptEmbedPrimary(page, dev.url, { storyId: 'nuxt-isolated', variantId: 'one' }, 'preview')).toBe(null)
      }
      const sandbox = page.frames().find(frame => frame.url().includes('__sandbox.html'))!
      await sandbox.getByRole('button', { name: 'one:0', exact: true }).click()
      await expect.poll(() => sandbox.getByRole('button', { name: /^one:/ }).textContent()).toBe('one:1')
      expect(await sandbox.getByText('test:/book/', { exact: true }).count()).toBe(1)
      expect(await sandbox.evaluate(() => (window as any).__VARIANT_NUXT__.map(item => [item.variant, item.meta]))).toEqual([['one', 'one']])
      // The other variant gets its own document, so useState is not shared.
      await page.evaluate(`session.selection.select({storyId:'nuxt-isolated',variantId:'two'})`)
      await expect.poll(() => sandbox.getByRole('button', { name: /^two:/ }).textContent()).toBe('two:0')
      expect(await sandbox.evaluate(() => (window as any).__VARIANT_NUXT__.map(item => [item.variant, item.meta]))).toEqual([['two', 'two']])
      await page.evaluate('session.dispose()')
    }
    finally {
      await page.close()
      await project.close()
      await browser.close()
      await hosts.close()
      await fixture.close()
    }
  })
})
