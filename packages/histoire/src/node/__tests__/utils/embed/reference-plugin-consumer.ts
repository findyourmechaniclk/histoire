import type { PluginBookFramework } from './plugin-book-consumer.js'
import { expect } from 'vitest'
import { createPackedPackageConsumer, fixturePackageVersion } from '../package-consumer.js'
import { writePluginBook } from './plugin-book-consumer.js'

/** Story frameworks of the reference plugin consumer books. */
export type ReferenceBookFramework = Extract<PluginBookFramework, 'vue' | 'react'>

/**
 * Installs the packed reference plugin with packed Histoire into a clean project, never through
 * workspace links. The React project installs no `vue`: Vue views run on the workbench's Vue.
 * @param directory Owned temporary directory.
 * @param framework Story framework of the book.
 */
export async function createReferencePluginConsumer(directory: string, framework: ReferenceBookFramework) {
  const support = framework === 'vue' ? '@histoire/plugin-vue' : '@histoire/plugin-react'
  const external = framework === 'vue' ? ['vue', '@vitejs/plugin-vue'] : ['react', 'react-dom', '@vitejs/plugin-react']
  const example = framework === 'vue' ? 'vue3' : 'react'
  const dependencies = Object.fromEntries(await Promise.all([...external, 'vite'].map(async name => [name, await fixturePackageVersion(name, example)])))
  return createPackedPackageConsumer(directory, { packages: ['histoire', support, 'histoire-example-plugin-reference'], dependencies })
}

/**
 * Writes a book using the reference plugin with a UI variant of another framework.
 * @param root Consumer root.
 * @param framework Story framework.
 * @param ui Reference plugin UI variant.
 * @param routerMode Workbench router mode.
 */
export async function writeReferenceBook(root: string, framework: ReferenceBookFramework, ui: string, routerMode: 'history' | 'hash') {
  return writePluginBook(root, framework, routerMode, 'import {referencePlugin} from \'histoire-example-plugin-reference\'', `referencePlugin({ui:${JSON.stringify(ui)},minTargetSize:1000})`)
}

export { servePluginBook as serveReferenceBook } from './plugin-book-consumer.js'

/**
 * Checks the Audit tab shows both findings: the frame plugin attached, reported over its channel,
 * and received `minTargetSize` from the descriptor options.
 * @param page Playwright page on the variant with `?tab=reference:audit`.
 * @param errors Page errors collected so far, shown when the tab never reports.
 */
export async function expectAuditFindings(page: any, errors: readonly string[]) {
  const panel = page.getByRole('tabpanel')
  try {
    await expect.poll(() => panel.textContent(), { timeout: 60_000 }).toContain('2 issues')
  }
  catch (error) {
    throw new Error(`Audit tab never reported. Page errors: ${errors.join('\n') || 'none'}`, { cause: error })
  }
  const text = await panel.textContent()
  expect(text).toContain('Missing alt')
  expect(text).toContain('below 1000 px')
}
