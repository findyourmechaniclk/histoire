import { invalid, wireRecord } from '../bridge/validation.js'

/** Strict object keys prevent undeclared runtime data crossing the boundary. */
function fields(input: Record<string, unknown>, names: string[]): void {
  if (Object.keys(input).some(name => !names.includes(name))) invalid('Unknown inspection row field')
}
/** Bounded descriptive text, allowing empty labels. */
function text(input: unknown, maximum: number): void {
  if (typeof input !== 'string' || input.length > maximum) invalid('Invalid inspection text')
}
/** Validate component prop metadata after shared JSON graph validation. */
export function validateInspectionComponents(value: unknown): void {
  if (!Array.isArray(value) || value.length > 100) invalid('Invalid component list')
  for (const item of value) {
    const component = wireRecord(item)
    fields(component, ['name', 'index', 'props'])
    text(component.name, 256)
    if (!Number.isSafeInteger(component.index) || (component.index as number) < 0 || !Array.isArray(component.props) || component.props.length > 100) invalid('Invalid component metadata')
    for (const item of component.props) {
      const prop = wireRecord(item)
      fields(prop, ['name', 'types', 'required', 'default', 'value', 'values'])
      text(prop.name, 256)
      if (prop.required !== undefined && typeof prop.required !== 'boolean') invalid('Invalid prop requirement')
      if (prop.types !== undefined) {
        if (!Array.isArray(prop.types) || prop.types.length > 16) invalid('Invalid prop types')
        for (const type of prop.types) text(type, 128)
      }
      if (prop.values !== undefined && (!Array.isArray(prop.values) || prop.values.length > 100)) invalid('Invalid prop values')
    }
  }
}
/** Validate preorder geometry and parents, rejecting impossible snapshot references. */
export function validateInspectionNodes(value: unknown): void {
  if (!Array.isArray(value) || value.length > 500) invalid('Invalid DOM nodes')
  for (const [index, item] of value.entries()) {
    const node = wireRecord(item)
    fields(node, ['index', 'parentIndex', 'tag', 'attributes', 'text', 'rect', 'styles'])
    if (node.index !== index || (index === 0 ? node.parentIndex !== null : !Number.isInteger(node.parentIndex) || (node.parentIndex as number) < 0 || (node.parentIndex as number) >= index)) invalid('Invalid DOM parent')
    text(node.tag, 128)
    text(node.text, 1000)
    for (const record of [node.attributes, node.styles]) {
      for (const entry of Object.values(wireRecord(record))) text(entry, 512)
    }
    const rect = wireRecord(node.rect)
    fields(rect, ['x', 'y', 'width', 'height'])
    for (const name of ['x', 'y', 'width', 'height']) {
      if (typeof rect[name] !== 'number' || !Number.isFinite(rect[name]) || (['width', 'height'].includes(name) && (rect[name] as number) < 0)) invalid('Invalid DOM geometry')
    }
  }
}
