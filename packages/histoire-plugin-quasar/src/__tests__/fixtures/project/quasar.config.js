import { basename, join } from 'node:path'
import { defineConfig } from '#q-app'
import { helperDir } from './build/helper.js'

// Common patterns from real projects: `__dirname`, `ctx.appPaths`, cwd-relative paths and local helpers.
export default defineConfig(ctx => ({
  boot: [process.cwd() === __dirname ? 'axios' : 'wrong-cwd'],
  css: [ctx.appPaths.resolve.src('css/app.css') === join(__dirname, 'src/css/app.css') ? 'app.css' : 'wrong.css'],
  extras: [basename(helperDir)],
  framework: { config: { dark: ctx.dev } },
}))
