// Compiled inline so consumers need no CSS pipeline.
import { installPluginStyles } from '@histoire/plugin-kit'
import css from '../styles.css?inline'

/** Install reference styles for lifetime of owning extension host. */
export function installReferenceStyles(signal: AbortSignal): void {
  installPluginStyles(document, 'reference', css, signal)
}
