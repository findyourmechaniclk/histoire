import { defineFramePlugin } from '@histoire/plugin-kit/frame'

/** Attach an actor so the workbench can resolve the exact current story document. */
export default defineFramePlugin({ id: 'vue-devtools', apiVersion: 1, attach() {} })
