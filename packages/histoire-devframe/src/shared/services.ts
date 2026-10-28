/** Explicit scopes; no generic SDK methods or shared-state writes. */
export type Exposure = 'inspection' | 'events' | 'diagnostics' | 'components' | 'accessibility' | 'highlight'

/** Finite schema describes an exact mounted read. */
const tool = {
  name: 'histoire_inspect_session',
  description: 'Read an explicitly paired mounted Histoire document.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      attachmentId: { type: 'string' },
      kind: { enum: ['variant', 'dom'] },
      target: { type: 'object' },
      expectedOwner: { type: 'object' },
      selector: { type: 'string' },
      maxNodes: { type: 'integer' },
      maxDepth: { type: 'integer' },
    },
    required: ['attachmentId', 'kind', 'target', 'expectedOwner'],
    additionalProperties: false,
  },
}

/** Event history is independently scoped and never activates diagnostics. */
const eventTool = {
  name: 'histoire_get_session_events',
  description: 'Read attributed component events retained by a paired live session.',
  inputSchema: {
    type: 'object' as const,
    properties: { attachmentId: { type: 'string' }, target: { type: 'object' }, expectedOwner: { type: 'object' }, eventLifetime: { type: 'string' }, afterSequence: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100 } },
    required: ['attachmentId', 'target', 'expectedOwner'],
    additionalProperties: false,
  },
}

/** Diagnostic history is granted independently of component events. */
const diagnosticTool = {
  name: 'histoire_get_session_diagnostics',
  description: 'Read explicitly observed diagnostics for a paired live session.',
  inputSchema: {
    type: 'object' as const,
    properties: { attachmentId: { type: 'string' }, target: { type: 'object' }, expectedOwner: { type: 'object' }, afterSequence: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100 } },
    required: ['attachmentId', 'target', 'expectedOwner'],
    additionalProperties: false,
  },
}

/** Component tree, instance detail and element-owner lookup share one finite service. */
const componentTool = {
  name: 'histoire_inspect_component',
  description: 'Read a component tree, instance or element owner from a paired session.',
  inputSchema: {
    type: 'object' as const,
    properties: { attachmentId: { type: 'string' }, target: { type: 'object' }, expectedOwner: { type: 'object' }, componentId: { type: 'string' }, selector: { type: 'string' }, rootId: { type: 'string' }, maxNodes: { type: 'integer' }, maxDepth: { type: 'integer' } },
    required: ['attachmentId', 'target', 'expectedOwner'],
    additionalProperties: false,
  },
}

/** Axe audit is available only through its explicit scope. */
const accessibilityTool = {
  name: 'histoire_audit_session_accessibility',
  description: 'Run a bounded accessibility audit of the mounted document.',
  inputSchema: {
    type: 'object' as const,
    properties: { attachmentId: { type: 'string' }, target: { type: 'object' }, expectedOwner: { type: 'object' }, selector: { type: 'string' } },
    required: ['attachmentId', 'target', 'expectedOwner'],
    additionalProperties: false,
  },
}

/** Highlight is an explicit bounded action, never a generic write. */
const highlightTool = {
  name: 'histoire_highlight_element',
  description: 'Temporarily highlight a selector or component in the paired mounted document.',
  annotations: { readOnlyHint: false, destructiveHint: false },
  inputSchema: {
    type: 'object' as const,
    properties: { attachmentId: { type: 'string' }, target: { type: 'object' }, expectedOwner: { type: 'object' }, selector: { type: 'string' }, componentId: { type: 'string' }, durationMs: { type: 'integer' } },
    required: ['attachmentId', 'target', 'expectedOwner'],
    oneOf: [{ required: ['selector'] }, { required: ['componentId'] }],
    additionalProperties: false,
  },
}

/** MCP descriptors and broker authorization share these exact registrations. */
export const LIVE_TOOLS = { tool, eventTool, diagnosticTool, componentTool, accessibilityTool, highlightTool }

/** Single finite service registry shared by browser, broker and MCP. */
export const LIVE_SERVICES = {
  histoire_inspect_session: { scope: 'inspection', action: false, tool },
  histoire_get_session_events: { scope: 'events', action: false, tool: eventTool },
  histoire_get_session_diagnostics: { scope: 'diagnostics', action: false, tool: diagnosticTool },
  histoire_inspect_component: { scope: 'components', action: false, tool: componentTool },
  histoire_audit_session_accessibility: { scope: 'accessibility', action: false, tool: accessibilityTool },
  histoire_highlight_element: { scope: 'highlight', action: true, tool: highlightTool },
} as const satisfies Record<string, { scope: Exposure, action: boolean, tool: { name: string } }>

/** Select component tree, exact details or element owner from finite fields. */
export function componentKind(input: Record<string, unknown>): 'components' | 'component' | 'componentForElement' {
  if (input.componentId !== undefined && input.selector !== undefined) throw new Error('Invalid component request')
  return input.componentId !== undefined ? 'component' : input.selector !== undefined ? 'componentForElement' : 'components'
}

/** Bind each finite service name to its exact operation kinds before dispatch. */
export function assertServiceOperation(name: string, value: unknown): void {
  const kinds: Record<string, readonly string[]> = {
    histoire_inspect_session: ['variant', 'dom'],
    histoire_inspect_component: ['components', 'component', 'componentForElement'],
    histoire_audit_session_accessibility: ['accessibility'],
    histoire_highlight_element: ['highlight'],
  }
  if (!Object.hasOwn(LIVE_SERVICES, name)) throw new Error('Session unavailable')
  if (!Object.hasOwn(kinds, name)) return
  if (!value || typeof value !== 'object' || Array.isArray(value) || !kinds[name].includes((value as { kind?: string }).kind ?? '')) throw new Error('Session unavailable')
}

/** Component-ID highlighting requires both action and component authority. */
export function serviceScopes(name: string, value: unknown): Exposure[] {
  const scope = LIVE_SERVICES[name as keyof typeof LIVE_SERVICES].scope
  return name === 'histoire_highlight_element' && value !== null && typeof value === 'object' && Object.hasOwn(value, 'componentId') ? [scope, 'components'] : [scope]
}
