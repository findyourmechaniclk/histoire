export { default as MountStory } from './MountStory'
export { default as RenderStory } from './RenderStory'

/**
 * `RenderStory` accepts `configureStory`: it configures the story itself, so
 * single variant frames can skip the hidden `MountStory` app.
 */
export const renderConfiguresStory = true

/** `RenderStory` accepts an explicit component-inspection opt-in. */
export const renderSupportsComponentInspection = true
