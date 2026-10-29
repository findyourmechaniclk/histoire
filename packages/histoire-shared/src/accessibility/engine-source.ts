/** Build a fixed local axe module without overwriting a story-owned global. */
export function createAxeEngineModule(source: string): string {
  const version = 'axe.version = \'4.14.0\';'
  const assignment = 'window.axe = axe;'
  const licenseEnd = source.indexOf('*/')
  if (!source.startsWith('/*! axe v4.14.0') || licenseEnd < 0 || source.split(version).length !== 2 || source.split(assignment).length !== 2) {
    throw new Error('Unsupported local accessibility engine')
  }
  const end = licenseEnd + 2
  const body = source.slice(end).replace(assignment, '__histoireAxeEngine = axe;')
  return `${source.slice(0, end)}\nconst module = undefined;\nconst define = undefined;\nlet __histoireAxeEngine;${body}\nexport default __histoireAxeEngine;\n`
}
