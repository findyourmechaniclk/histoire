// Workbench entry (`workbench.client`) of the svelte variant: Svelte 5 views through `svelte5View`.
import { createSvelteViews } from '../svelte/views.js'
import { defineReferencePlugin } from '../workbench/define.js'

export default defineReferencePlugin(createSvelteViews)
