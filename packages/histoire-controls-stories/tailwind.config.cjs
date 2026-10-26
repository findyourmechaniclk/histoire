const path = require('node:path')
const inherited = require('../../tailwind.config.cjs')

// This story app remains on v3; the controls package itself compiles v4 CSS.
module.exports = {
  ...inherited,
  prefix: 'htw-',
  content: [path.resolve(__dirname, '../histoire-controls/src/**/*.{vue,js,ts,jsx,tsx,md}')],
  corePlugins: { preflight: false },
}
