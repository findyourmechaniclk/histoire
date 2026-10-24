import { defineConfig } from '#q-app'

export default defineConfig(() => ({
  boot: ['greeting'],
  css: ['app.css'],
  extras: ['roboto-font', 'material-icons'],
  framework: {
    config: {
      brand: { primary: '#2e7d32' },
    },
    plugins: ['Notify'],
  },
  build: {
    vueRouterMode: 'hash',
  },
}))
