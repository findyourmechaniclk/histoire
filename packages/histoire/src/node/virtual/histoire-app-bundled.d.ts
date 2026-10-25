/** Components exposed by the shared sandbox entry, compiled under vendor aliases. */
declare module '@histoire/app/sandbox' {
  import type { DefineComponent } from '@histoire/vendors/vue'

  /** Bootstrap story metadata and registered variants. */
  export const GenericMountStory: DefineComponent
  /** Mount the selected story variant. */
  export const GenericRenderStory: DefineComponent
}
