/**
 * Returns the file of Nuxt UI's `App` component (`UApp`) among the Nuxt
 * components, if registered.
 * @param components Nuxt components (`components:extend` hook).
 * @param prefix Nuxt UI component prefix (`ui.prefix`), `U` by default.
 */
export function findUiAppComponent(components: Array<{ pascalName: string, filePath: string }>, prefix = 'U') {
  return components.find(component => component.pascalName === `${prefix}App`)?.filePath
}
