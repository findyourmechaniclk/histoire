import { HstQuasar } from '@histoire/plugin-quasar'
import { HstVue } from '@histoire/plugin-vue'
import { defineConfig } from 'histoire'

export default defineConfig({
  storyMatch: ['src/**/*.story.vue'],
  plugins: [
    HstVue(),
    HstQuasar(),
  ],
})
