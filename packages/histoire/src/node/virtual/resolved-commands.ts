import type { PluginCommand } from '@histoire/shared'
import type { Context } from '../context.js'

const serializedFields: Readonly<(keyof PluginCommand)[]> = ['id', 'label', 'prompts', 'icon', 'searchText'] as const

/**
 * Generates `virtual:$histoire-commands`: serializable command fields, spread with the
 * exports of each command's client setup file.
 * @param ctx Histoire context holding registered commands and their resolved setup files.
 */
export function resolvedCommands(ctx: Context) {
  const imports: string[] = []
  const commands: string[] = []

  for (const command of ctx.registeredCommands) {
    const fields = getCommandFields(ctx, command, imports)
    commands.push(`{ ${fields.join(', ')} }`)
  }

  return `${imports.join('\n')}
export const registeredCommands = [${commands.join(', ')}]
`
}

/**
 * Builds one command's object literal fields, adding its setup import when it has one.
 * @param ctx Histoire context.
 * @param command Registered command.
 * @param imports Module import statements, appended in place.
 */
function getCommandFields(ctx: Context, command: PluginCommand, imports: string[]) {
  const fields: string[] = []

  for (const field of serializedFields) {
    if (command[field] != null) {
      fields.push(`${field}: ${JSON.stringify(command[field])}`)
    }
  }

  // Add client-side data, imported from the file resolved at startup (see `config/browser-entries.ts`).
  if (command.clientSetupFile) {
    const file = ctx.commandClientSetupFiles?.get(command)
    if (!file) throw new Error(`[histoire] command ${JSON.stringify(command.id)} clientSetupFile was not resolved`)
    const importedVar = `__setup${imports.length}__`
    if (typeof command.clientSetupFile === 'string') {
      imports.push(`import ${importedVar} from ${JSON.stringify(file)}`)
    }
    else {
      imports.push(`import { ${command.clientSetupFile.importName} as ${importedVar} } from ${JSON.stringify(file)}`)
    }
    fields.push(`...${importedVar}`)
  }

  return fields
}
