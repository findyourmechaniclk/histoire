import { createRequire } from 'node:module'
import { join } from 'node:path'

/** Unique values, keeping first occurrence order. */
export function unique<T>(list: T[]): T[] {
  return [...new Set(list)]
}

/** Quasar components named in `framework.config` (e.g. a spinner) must be imported. */
const quasarComponentRE = /^Q[A-Z]/

/** `framework.config` keys whose `spinner` may name a Quasar component. */
const spinnerConfigKeys = ['loading', 'notify'] as const

/** Quasar component spinner names set in `framework.config`. */
export function getConfigSpinners(config: Record<string, any>): Array<{ key: typeof spinnerConfigKeys[number], spinner: string }> {
  return spinnerConfigKeys
    .map(key => ({ key, spinner: config[key]?.spinner }))
    .filter(({ spinner }) => typeof spinner === 'string' && quasarComponentRE.test(spinner))
}

/** `require` resolving packages from the Quasar project, like Quasar CLI does. */
export function projectRequire(root: string) {
  return createRequire(join(root, 'package.json'))
}
