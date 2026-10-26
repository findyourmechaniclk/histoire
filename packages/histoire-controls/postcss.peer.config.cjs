/** Scope every peer stylesheet rule, including imported FloatingVue and SFC styles. */
const scope = {
  postcssPlugin: 'histoire-peer-root',
  OnceExit(root) {
    root.walkRules((rule) => {
      let parent = rule.parent
      while (parent) {
        if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return
        parent = parent.parent
      }
      rule.selectors = rule.selectors.map((selector) => {
        if (['html', ':root', ':host'].includes(selector)) return '.histoire-provider'
        // Zero-specificity font/color resets still need to beat host element resets.
        // Component classes already supply that floor and need no provider weight.
        const provider = /^:where\([^()]*\)$/.test(selector) ? '.histoire-provider' : ':where(.histoire-provider)'
        return `${provider} ${selector}`
      })
    })
  },
}
module.exports = {
  plugins: [
    require('@tailwindcss/postcss')({ base: __dirname }),
    require('./scripts/postcss-tailwind-isolation.cjs'),
    scope,
  ],
}
