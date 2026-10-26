const flattenTailwindLayers = require('./flatten-tailwind-layers.cjs')

const layers = new Map([
  ['base', 'histoire-base'],
  ['components', 'histoire-components'],
  ['utilities', 'histoire-utilities'],
])

/** Isolate generated defaults and keep v3 consumer compilers from owning v4 layers. */
module.exports = {
  postcssPlugin: 'histoire-tailwind-isolation',
  OnceExit(root) {
    root.walkAtRules('layer', (layer) => {
      if (layer.params === 'properties' && layer.nodes) {
        // Native @property supplies these defaults in supported browsers. The
        // universal fallback would otherwise overwrite a story's v4 effects.
        layer.remove()
        return
      }
      // V3 treats these three exact names as compile-time directives, rejecting
      // or purging a precompiled v4 sheet imported by a consumer like Nuxt.
      const names = layer.params.split(',').map(name => name.trim())
      layer.params = names.flatMap(name => layers.has(name)
        ? layer.nodes ? [layers.get(name)] : [name, layers.get(name)]
        : [name]).join(', ')
      // Imports can nest the same components layer. Flatten it so native CSS
      // and untouched app CSS still resolve by specificity, as they did in v3.
      if (layer.nodes && layer.parent?.type === 'atrule' && layer.parent.name === 'layer' && layer.parent.params === layer.params) {
        layer.replaceWith(...layer.nodes)
      }
    })
    flattenTailwindLayers(root)
  },
}
