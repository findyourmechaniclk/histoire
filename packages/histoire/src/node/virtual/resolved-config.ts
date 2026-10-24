import type { Context } from '../context.js'

/**
 * Generates the `virtual:$histoire-config` module code served to the browser.
 * Node-only settings are stripped explicitly instead of relying on JSON dropping functions.
 * @param ctx Histoire context holding the resolved config and mode.
 * @returns Module source exporting `config` and `logos`.
 */
export function resolvedConfig(ctx: Context) {
  // Trusted launch policy can contain an absolute executable path; keep it server-side.
  // Node plugin objects and Vite options (functions or objects) are server-only too.
  const { agents, browser: _browser, comments, plugins: _plugins, vite: _vite, ...publicConfig } = ctx.config
  // Agent environment belongs to user-level process settings. It must never
  // enter a browser module, including development's public virtual config.
  const config = ctx.mode === 'dev'
    ? { ...publicConfig, comments, agents: agents ? { ...agents, presets: agents.presets?.map(({ env: _env, ...preset }) => preset) } : undefined }
    : publicConfig
  let js = `export const config = ${JSON.stringify(config)}\n`
  if (ctx.config.theme?.logo) {
    for (const key in ctx.config.theme.logo) {
      js += `import Logo_${key} from '${ctx.config.theme.logo[key]}'\n`
    }
  }
  js += `export const logos = {${Object.keys(ctx.config.theme?.logo ?? {}).map(key => `${key}: Logo_${key}`).join(', ')}}\n`
  return js
}
