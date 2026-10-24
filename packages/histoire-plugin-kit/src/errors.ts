/** Invalid plugin definition or id, attributed to the plugin when its id is known. */
export class PluginDefinitionError extends Error {
  /** Offending plugin id, when it was readable. */
  readonly pluginId: string | undefined

  /**
   * @param message Failure description without attribution prefix.
   * @param pluginId Plugin the failure belongs to, if known.
   */
  constructor(message: string, pluginId?: string) {
    super(pluginId === undefined ? `[histoire plugin] ${message}` : `[histoire plugin "${pluginId}"] ${message}`)
    this.name = 'PluginDefinitionError'
    this.pluginId = pluginId
  }
}
