/** Global registered by the App Extension boot file. */
export default ({ app }) => {
  app.config.globalProperties.$extensionMessage = 'Hello from an App Extension'
}
