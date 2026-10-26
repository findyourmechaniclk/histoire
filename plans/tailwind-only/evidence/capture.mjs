import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { expect, ready } from './capture-actions.mjs'
import { requireExample } from './dependencies.mjs'
import { modes, nuxtScreens, screens } from './screens.mjs'

/** Run the capture CLI and report failures through its process exit status. */
async function main() {
  const { chromium } = requireExample('playwright')
  const { minimatch } = requireExample('minimatch')
  const { values } = parseArgs({ options: {
    out: { type: 'string' },
    port: { type: 'string' },
    only: { type: 'string', default: '*' },
    modes: { type: 'string', default: 'light,dark,compact,narrow' },
    suite: { type: 'string', default: 'vue3' },
    base: { type: 'string', default: '/' },
  } })
  if (!values.out || !values.port) throw new Error('Usage: node capture.mjs --out <dir> --port <n> [--only <glob>] [--modes light,dark,compact,narrow] [--suite vue3|nuxt-ui] [--base /]')
  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535 || [6006, 6106].includes(port)) throw new Error('Use an available port other than reserved 6006/6106')
  const selectedModes = values.modes.split(',')
  if (selectedModes.some(mode => !modes[mode])) throw new Error(`Unknown mode: ${values.modes}`)
  if (!['vue3', 'nuxt-ui'].includes(values.suite)) throw new Error(`Unknown suite: ${values.suite}`)
  const cases = (values.suite === 'vue3' ? screens : nuxtScreens).filter(screen => minimatch(screen.name, values.only))
  if (!cases.length) throw new Error(`No screens match ${values.only}`)
  const out = resolve(values.out)
  const origin = `http://127.0.0.1:${port}`
  const base = values.base
  if (!base.startsWith('/') || !base.endsWith('/') || /[?#]/.test(base)) throw new Error('Base must be a path starting and ending with /')
  await mkdir(out, { recursive: true })

  /** Use the app's actual persistence contracts, including its separate theme storage. */
  async function seed(context, mode, screen) {
    await context.addInitScript(({ mode, screen }) => {
      const theme = mode.dark ? 'dark' : 'light'
      localStorage.setItem('histoire-color-scheme', theme)
      sessionStorage.setItem('histoire-color-scheme', theme)
      localStorage.setItem('_histoire-ui-settings', JSON.stringify({ density: mode.density, syncZoom: false, watchTests: false }))
      localStorage.setItem('_histoire-ui-shell', JSON.stringify({ pane: screen.pane ?? 'stories', panelOpen: Boolean(screen.pane) || mode.width > 640, inspectorOpen: mode.width > 640 || Boolean(screen.inspector), sourceExpanded: false, panelWidth: 280, inspectorWidth: 340, aiSection: 'threads' }))
    }, { mode, screen: { pane: screen.pane, inspector: screen.inspector } })
  }

  /** Settle loaded fonts and images in every document, with animations disabled on capture. */
  async function settle(page) {
    // Lazy controls request fonts after canvas readiness; wait for their network and UI states too.
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.workbench-loading-skeleton:visible')).toHaveCount(0)
    await expect(page.getByText('Waiting for audit', { exact: true })).toHaveCount(0)
    await expect(page.locator('.hst-ref-chip').filter({ hasText: /^…$/ })).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    for (const frame of page.frames()) {
      await frame.evaluate(async () => {
        // Variable font faces can be requested after layout; explicitly await the shipped faces.
        await Promise.all([
          document.fonts.load('400 13px "Manrope"'),
          document.fonts.load('800 24px "Manrope"'),
          document.fonts.load('400 11px "JetBrains Mono"'),
        ])
        await document.fonts.ready
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})))
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
    }
    await page.mouse.move(0, 0)
  }

  let results = []
  try {
    results = JSON.parse(await readFile(resolve(out, 'manifest.json'), 'utf8')).results
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const browser = await chromium.launch({ chromiumSandbox: false })
  /** Let the browser release its own subprocesses before a session interrupt exits Node. */
  async function interrupted() {
    await browser.close()
    process.exit(130)
  }
  process.once('SIGINT', interrupted)
  process.once('SIGTERM', interrupted)
  try {
    for (const screen of cases) {
      for (const name of selectedModes) {
        const mode = modes[name]
        const context = await browser.newContext({ viewport: { width: mode.width, height: mode.height }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: mode.dark ? 'dark' : 'light', locale: 'en-US', timezoneId: 'UTC' })
        const errors = []
        // Keep timed-out readiness checks diagnosable without weakening their network-idle gate.
        const pendingRequests = new Set()
        const record = { suite: values.suite, origin, base, screen: screen.name, mode: name, path: screen.path, viewport: [mode.width, mode.height], errors }
        let page
        try {
          // A failed rerun must not leave an older PNG looking like current proof.
          await rm(resolve(out, `${screen.name}-${name}.png`), { force: true })
          await rm(resolve(out, `${screen.name}-${name}.failure.txt`), { force: true })
          await seed(context, mode, screen)
          page = await context.newPage()
          page.on('request', request => pendingRequests.add(request))
          page.on('requestfinished', request => pendingRequests.delete(request))
          page.on('requestfailed', request => pendingRequests.delete(request))
          page.on('pageerror', error => errors.push(error.message))
          page.on('response', (response) => {
            if (response.url().startsWith(origin) && response.status() >= 400 && ['stylesheet', 'script', 'font', 'image'].includes(response.request().resourceType())) {
              errors.push(`${response.status()} ${response.url()}`)
            }
          })
          await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'))
          await page.goto(`${origin}${base.slice(0, -1)}${screen.path}`, { waitUntil: 'domcontentloaded' })
          await expect(page.locator('.histoire-shell-layout')).toHaveAttribute('data-density', mode.density)
          await expect(page.locator('html')).toHaveClass(mode.dark ? /htw-dark/ : /^(?!.*htw-dark)/)
          if (screen.canvas !== false) await ready(page)
          if (screen.wait) await expect(page.locator(screen.wait).first()).toBeVisible()
          await screen.setup?.(page)
          await settle(page)
          record.typography = await page.evaluate(() => ['.histoire-canvas-viewport', '.histoire-canvas-heading h1', '.histoire-frame-label', '.measure-path'].map((selector) => {
            const element = document.querySelector(selector)
            if (!element) return { selector }
            const style = getComputedStyle(element)
            return { selector, family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight }
          }))
          record.file = `${screen.name}-${name}.png`
          await page.screenshot({ path: resolve(out, record.file), animations: 'disabled', caret: 'hide' })
          record.status = errors.length ? 'captured-with-errors' : 'captured'
          record.url = page.url()
          process.stdout.write(`${record.file}: ${record.status}\n`)
        }
        catch (error) {
          record.status = 'failed'
          record.failure = error.message
          const body = await page?.locator('body').textContent({ timeout: 1000 }).catch(() => '')
          await writeFile(resolve(out, `${screen.name}-${name}.failure.txt`), `${error.message}\n\nPending requests: ${JSON.stringify([...pendingRequests].map(request => request.url()))}\n\n${body ?? ''}\n`)
          process.stderr.write(`${screen.name}-${name}: ${error.message.split('\n')[0]}\n`)
        }
        finally {
          results = results.filter(item => item.screen !== record.screen || item.mode !== record.mode)
          results.push(record)
          await context.close()
          await writeFile(resolve(out, 'manifest.json'), `${JSON.stringify({ browser: browser.version(), node: process.version, fixedTime: '2026-10-25T12:00:00Z', results }, null, 2)}\n`)
        }
      }
    }
  }
  finally {
    await browser.close()
  }
  process.exitCode = results.some(result => result.status !== 'captured') ? 1 : 0
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
