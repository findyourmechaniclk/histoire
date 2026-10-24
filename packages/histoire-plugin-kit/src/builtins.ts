import type { BuiltinInspectorTab } from './types/inspector.js'

/** Built-in inspector tab descriptor shared by the standalone inspector and native explorer panels. */
export interface BuiltinInspectorTabDescriptor {
  /** Qualified id sections and navigation use. */
  readonly id: BuiltinInspectorTab
  /** Legacy standalone `?tab=` value; Props is the empty value. */
  readonly value: '' | 'docs' | 'events' | 'tests'
  /** Visible label. */
  readonly label: string
}

/** Built-in inspector tabs in display order; plugin tabs follow them in every host. */
export const BUILTIN_INSPECTOR_TABS: readonly BuiltinInspectorTabDescriptor[] = Object.freeze([
  { id: 'builtin:props', value: '', label: 'Props' },
  { id: 'builtin:docs', value: 'docs', label: 'Docs' },
  { id: 'builtin:events', value: 'events', label: 'Events' },
  { id: 'builtin:tests', value: 'tests', label: 'Tests' },
] satisfies BuiltinInspectorTabDescriptor[])
