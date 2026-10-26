/** Keep document-wide declarations outside the workbench's story-exclusion scope. */
function isGlobalRule(node) {
  return node.type === 'atrule' && (node.name === 'import' || node.name === 'property' || (node.name === 'layer' && !node.nodes))
}

/** Wrap app styles without restricting global property registration or layer order. */
module.exports = (opts = {}) => {
  const { from = ':root', to } = opts
  const params = `(${from})${to ? ` to (${to})` : ''}`
  return {
    postcssPlugin: 'postcss-scope-wrapper',
    // Tailwind expands imports in Once; scope the finished output afterward.
    OnceExit(root, { AtRule }) {
      const globals = []
      root.walkAtRules((node) => {
        if (isGlobalRule(node)) globals.push(node)
      })
      globals.forEach(node => root.append(node))
      const scope = new AtRule({ name: 'scope', params })
      for (const node of [...root.nodes]) {
        if (isGlobalRule(node)) continue
        node.walkRules?.((rule) => {
          rule.selectors = rule.selectors.map(selector => selector === ':root' || selector === 'html' ? ':scope' : selector)
        })
        if (node.type === 'rule') {
          node.selectors = node.selectors.map(selector => selector === ':root' || selector === 'html' ? ':scope' : selector)
        }
        scope.append(node)
      }
      root.append(scope)
    },
  }
}
module.exports.postcss = true
