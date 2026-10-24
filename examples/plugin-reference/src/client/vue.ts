// Workbench entry (`workbench.client`) of the vue variant: workbench Vue components (SFCs precompiled against the workbench's Vue).
import { createVueViews } from '../vue/views.js'
import { defineReferencePlugin } from '../workbench/define.js'

export default defineReferencePlugin(createVueViews)
