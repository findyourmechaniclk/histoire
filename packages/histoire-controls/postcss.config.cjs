module.exports = {
  plugins: [
    require('@tailwindcss/postcss')({ base: __dirname }),
    require('./scripts/postcss-tailwind-isolation.cjs'),
  ],
}
