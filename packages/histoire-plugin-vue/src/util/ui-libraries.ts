/**
 * Vue UI libraries shipping untranspiled CSS/ESM side effects that story
 * collection (vite-node) must run through Vite instead of Node.
 */
const knownUiLibraries = [
  'vuetify',
  'quasar',
  'primevue',
  'element-plus',
  '@ionic/vue',
  '@ionic/core',
  'ant-design-vue',
]

/** Escape a string for use inside a RegExp. */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `viteNodeInlineDeps` patterns matching the installed package folders of
 * known UI libraries (either path separator, pnpm nested `node_modules` included).
 */
export function getUiLibraryInlineDeps(): RegExp[] {
  return knownUiLibraries.map(name => new RegExp(`[\\\\/]node_modules[\\\\/]${name.split('/').map(escapeRegExp).join('[\\\\/]')}[\\\\/]`))
}
