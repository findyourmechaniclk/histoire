// Workbench entry (`workbench.client`) of the svelte4 variant: Svelte 4 views through `svelte4View`.
import { createSvelte4Views } from '../svelte4/views.js'
import { defineReferencePlugin } from '../workbench/define.js'

export default defineReferencePlugin(createSvelte4Views)
