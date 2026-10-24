export { default as MountStory } from './MountStory'
export { default as RenderStory } from './RenderStory'

/**
 * `RenderStory` accepts `configureStory`: it configures the story itself, so
 * single variant frames can skip the hidden `MountStory` app.
 */
export const renderConfiguresStory = true
