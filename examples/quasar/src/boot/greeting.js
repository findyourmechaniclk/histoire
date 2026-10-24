import { defineBoot } from '#q-app'

/** Global registered by a boot file, used by stories. */
export default defineBoot(({ app, router }) => {
  app.config.globalProperties.$greeting = router ? 'Hello from a Quasar boot file' : 'No router'
})
