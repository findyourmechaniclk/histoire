/**
 * Generated-code helper wrapping every dynamic story import.
 *
 * Story modules transformed by Vitest's mocker go through
 * `__vitest_browser_runner__.wrapDynamicImport()` so their mocks apply; outside
 * a real Vitest browser run (or before its runner booted) the stub installed
 * here just calls the loader. Emitted by every generated module that imports a
 * story, so they all agree on the same wrapper.
 */
export const VITEST_DYNAMIC_IMPORT_SNIPPET = `function ensureVitestRunner() {
  const runner = globalThis.__vitest_browser_runner__ ?? {}
  if (typeof runner.wrapDynamicImport !== 'function') {
    runner.wrapDynamicImport = loader => loader()
  }
  globalThis.__vitest_browser_runner__ = runner
  return runner
}

function runWithVitestDynamicImport(loader) {
  return ensureVitestRunner().wrapDynamicImport(loader)
}`

/**
 * Renders the inline script that guarantees a usable
 * `__vitest_browser_runner__` and `__vitest_mocker__` before the app entry runs.
 *
 * Story modules transformed by Vitest's mocker call
 * `__vitest_browser_runner__.wrapDynamicImport()` (built output) or
 * `__vitest_mocker__.wrapDynamicImport()` (dev transforms, e.g. the workbench
 * plugin manifest the dev source-origin explorer imports), which do not exist
 * outside a real Vitest browser run. Every HTML document Histoire serves (the
 * dev server's and the built ones) needs the same stub — emitting it from one
 * place keeps a divergence from silently breaking one of the runtimes. A real
 * mocker installed later replaces the passthrough.
 * @param indent Leading whitespace of every emitted line, so the surrounding
 * HTML document keeps its own indentation.
 */
export function renderVitestRunnerBootstrap(indent = '') {
  return [
    `${indent}<script>`,
    `${indent}(() => {`,
    `${indent}  for (const key of ['__vitest_browser_runner__', '__vitest_mocker__']) {`,
    `${indent}    const runner = globalThis[key] ?? {}`,
    `${indent}    if (typeof runner.wrapDynamicImport !== 'function') {`,
    `${indent}      runner.wrapDynamicImport = loader => loader()`,
    `${indent}    }`,
    `${indent}    globalThis[key] = runner`,
    `${indent}  }`,
    `${indent}})()`,
    `${indent}</script>`,
  ].join('\n')
}
