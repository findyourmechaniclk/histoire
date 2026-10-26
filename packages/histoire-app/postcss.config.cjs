module.exports = {
  plugins: [
    require('@tailwindcss/postcss')({ base: __dirname }),
    require('@histoire/controls/scripts/postcss-tailwind-isolation.cjs'),
    require('./postcss-scope-wrapper.cjs')({ from: ':root', to: '.__histoire-render-story:not(.__histoire-render-custom-controls)' }),
  ],
}
