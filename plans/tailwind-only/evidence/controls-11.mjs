import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { requireExample, requireHistoire } from './dependencies.mjs'

/** Capture native CSS parity without starting a book server. */
async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' } } })
  const root = resolve(import.meta.dirname, '../../..')
  const requireControls = createRequire(resolve(root, 'packages/histoire-controls/package.json'))
  const { createSSRApp, h } = requireControls('vue')
  const { renderToString } = requireControls('vue/server-renderer')
  const controls = await import(pathToFileURL(resolve(root, 'packages/histoire-controls/dist/peer/index.js')))
  const postcss = requireHistoire('postcss')
  const { chromium } = requireExample('playwright')
  const before = JSON.parse(await readFile(new URL('./controls-11/before-sources.json', import.meta.url), 'utf8'))
  const out = values.out ? resolve(values.out) : resolve(import.meta.dirname, 'controls-11')
  await mkdir(out, { recursive: true })

  /** Render real shared controls without application utilities or mocked component code. */
  function controlRows() {
    return h('div', { style: 'width:520px;padding:20px;display:grid;gap:12px' }, [
      h('div', { style: 'display:flex;gap:8px' }, ['default', 'flat', 'primary'].map(color => h(controls.HstButton, { color }, () => color))),
      h('div', { style: 'display:flex;gap:8px' }, [
        h(controls.HstButton, { 'color': 'flat', 'aria-pressed': true }, () => 'Selected'),
        h(controls.HstButton, { disabled: true }, () => 'Disabled'),
        h(controls.HstButton, { 'color': 'flat', 'tone': 'accent', 'aria-pressed': true }, () => 'Accent selected'),
        h(controls.HstButton, { 'color': 'flat', 'tone': 'danger', 'aria-pressed': true }, () => 'Danger selected'),
        h(controls.HstButton, { iconOnly: true }, () => '+'),
      ]),
      h(controls.HstButtonGroup, { title: 'Group', options: ['One', 'Two', 'Three'], modelValue: 'Two' }),
      h(controls.HstButtonGroup, { title: 'Inline', layout: 'horizontal', options: ['One', 'Two'], modelValue: 'One' }),
      h(controls.HstText, { title: 'Text', modelValue: 'A value' }),
      h(controls.HstText, { title: 'Inline text', layout: 'horizontal', modelValue: 'Another value' }),
      h(controls.HstNumber, { title: 'Number', modelValue: 12 }),
      h(controls.HstTextarea, { title: 'Notes', modelValue: 'Control content' }),
      h(controls.HstCheckbox, { title: 'Checked', modelValue: true }),
    ])
  }
  const markup = await renderToString(createSSRApp({ render: controlRows }))
  // Preserve the package's real import order, including equal-specificity fallbacks.
  const nativeEntry = 'packages/histoire-vue/src/styles/style.css'
  const nativeFiles = [...before[nativeEntry].matchAll(/^@import '\.\/(.+)';$/gm)].map(match => `packages/histoire-vue/src/styles/${match[1]}`)
  const nativeBefore = nativeFiles.map(path => before[path]).join('\n') + before[nativeEntry].replaceAll(/^@import .*;$/gm, '')
  const nativeAfter = (await Promise.all(nativeFiles.map(path => readFile(resolve(root, path), 'utf8')))).join('\n') + (await readFile(resolve(root, nativeEntry), 'utf8')).replaceAll(/^@import .*;$/gm, '')
  const controlBefore = before['packages/histoire-controls/src/style/controls.pcss']
  const controlAfter = await readFile(resolve(root, 'packages/histoire-controls/src/style/controls.pcss'), 'utf8')
  const peerTheme = await readFile(resolve(root, 'packages/histoire-controls/src/style/peer-theme.css'), 'utf8')
  const foundation = postcss.parse(await readFile(resolve(root, 'packages/histoire-controls/dist/style-standalone.css'), 'utf8'))
  // Compare each revision without leaking current component rules into its baseline.
  foundation.walkAtRules('font-face', rule => rule.remove())
  foundation.walkRules((rule) => {
    if (/histoire-|v-popper/.test(rule.selector)) rule.remove()
  })

  /** Match the actual peer root transform while preserving its before/after qualification. */
  function peerRules(source, qualifier) {
    const parsed = postcss.parse(source)
    if (qualifier.startsWith(':where')) {
      // Consume the actual peer transform for current CSS; only legacy scoping is replayed.
      requireControls('./postcss.peer.config.cjs').plugins.at(-1).OnceExit(parsed)
    }
    else {
      parsed.walkRules((rule) => {
        rule.selectors = rule.selectors.map(selector => `${qualifier} ${selector}`)
      })
    }
    return parsed.toString()
  }
  const nativePanels = `<div class="histoire-controls"><fieldset><legend>Controls</legend>${markup}</fieldset></div><div class="histoire-tests"><div class="histoire-tests-header"><div class="histoire-tests-actions"><div class="histoire-tests-run-group"><button class="histoire-button histoire-tests-run" data-color="flat">Run</button><button class="histoire-button histoire-icon-button histoire-tests-run-trigger" data-color="flat">+</button></div></div></div><div class="histoire-test-row"><div class="histoire-test-row-main">Test result</div><div class="histoire-test-errors"><div class="histoire-test-error"><pre class="histoire-test-error-message">Expected value</pre></div></div></div></div><div class="histoire-docs"><h2>Documentation</h2><p>Text with <a href="#">link</a> and <code>code</code>.</p><pre>Example source</pre><p role="alert">Source error</p></div><div class="histoire-source"><p role="alert">Source unavailable</p></div><div class="histoire-events"><div class="histoire-virtual-list"><ol><li>Native event</li></ol></div></div><div class="histoire-tree"><button class="histoire-button" data-color="flat" aria-current="true">Tree selected</button><button class="histoire-button" data-color="flat">Tree hover</button></div><div class="histoire-content-actions"><button class="histoire-button" data-color="flat" aria-pressed="true">Source selected</button><button class="histoire-button" data-color="flat">Source hover</button></div>`
  const browser = await chromium.launch({ chromiumSandbox: false })
  try {
    for (const peer of [false, true]) {
      for (const dark of [false, true]) {
        for (const state of peer ? ['normal', 'hover', 'focus', 'tree-hover', 'source-hover'] : ['normal', 'hover', 'focus']) {
          for (const revision of ['before', 'after']) {
            const page = await browser.newPage({ viewport: { width: 720, height: peer ? 1500 : 850 }, reducedMotion: 'reduce' })
            // Generated output provides real theme/font assets. Later rules select the revision.
            const css = revision === 'before' ? controlBefore : controlAfter
            const native = revision === 'before' ? nativeBefore : nativeAfter
            const theme = postcss.parse(peerTheme)
            theme.walkAtRules('theme', (rule) => {
              rule.replaceWith(...rule.nodes)
            })
            const rootTheme = theme.nodes.map(node => node.toString()).join('\n')
            const hostReset = peer ? 'button,input,textarea{font-family:serif;font-size:17px;box-sizing:content-box;color:navy}' : ''
            const sheet = peer ? peerRules(css, revision === 'before' ? '.histoire-provider' : ':where(.histoire-provider)') + native : css
            await page.setContent(`<style>${foundation.toString()}</style><style>:root{${rootTheme}} body{margin:0;background:${dark ? '#16171b' : '#fff'}} ${hostReset} ${sheet} .histoire-provider{height:auto;display:block}</style><div ${peer ? 'class="histoire-provider"' : ''} ${dark ? 'data-histoire-appearance="dark"' : ''}>${peer ? nativePanels : markup}</div>`)
            if (dark) await page.locator('[data-histoire-control-appearance]').evaluateAll(elements => elements.forEach(element => element.setAttribute('data-histoire-control-appearance', 'dark')))
            if (state === 'hover') await page.getByRole('button', { name: 'flat', exact: true }).first().hover()
            if (state === 'focus') await page.getByRole('button', { name: 'flat', exact: true }).first().focus()
            if (state === 'tree-hover') await page.getByRole('button', { name: 'Tree hover', exact: true }).hover()
            if (state === 'source-hover') await page.getByRole('button', { name: 'Source hover', exact: true }).hover()
            const name = `${peer ? 'peer' : 'standalone'}-${dark ? 'dark' : 'light'}-${state}`
            await mkdir(resolve(out, revision), { recursive: true })
            await page.screenshot({ path: resolve(out, revision, `${name}.png`), fullPage: true })
            await page.close()
          }
        }
      }
    }
    await writeFile(resolve(out, 'scope.json'), JSON.stringify({ cases: 16, controls: 'Real Hst SSR controls', native: 'Representative native panel markup', states: ['normal', 'hover', 'focus', 'tree-hover', 'source-hover'], fonts: 'System fallback, same in both revisions; app font coverage belongs to full matrix' }, null, 2))
  }
  finally {
    await browser.close()
  }
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
