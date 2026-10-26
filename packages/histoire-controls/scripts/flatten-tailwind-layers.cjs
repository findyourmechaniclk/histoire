/** Preserve Histoire's v3 specificity against consumers' unlayered resets. */
module.exports = function flattenTailwindLayers(root) {
  const utilities = []
  root.walkAtRules('layer', (layer) => {
    if (!layer.nodes || !['theme', 'base', 'components', 'utilities', 'histoire-base', 'histoire-components', 'histoire-utilities'].includes(layer.params)) return
    if (['utilities', 'histoire-utilities'].includes(layer.params)) {
      utilities.push(...layer.nodes)
      layer.remove()
    }
    else {
      layer.replaceWith(...layer.nodes)
    }
  })
  // V3 emitted utilities after imported defaults. Keep that order after flattening.
  root.append(utilities)
  const hidden = []
  root.walkRules('.htw-sandbox-hidden', rule => hidden.push(rule))
  hidden.forEach(rule => root.append(rule))
}
