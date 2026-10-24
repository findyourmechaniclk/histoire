/** Attributes and listeners accepted by {@link h}. */
export type DomProps = Record<string, string | number | boolean | null | undefined | ((event: Event) => void)>

/**
 * Creates an element: `on*` props become listeners, `false`/`null`/`undefined` are skipped.
 * @param tag Element name.
 * @param props Attributes and listeners.
 * @param children Child nodes or text.
 */
export function h(tag: string, props: DomProps = {}, ...children: Array<Node | string | null | undefined | false>): HTMLElement {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(props)) {
    if (typeof value === 'function') element.addEventListener(name.slice(2).toLowerCase(), value)
    else if (value === true) element.setAttribute(name, '')
    else if (value !== false && value != null) element.setAttribute(name, String(value))
  }
  for (const child of children) {
    if (child || child === '') element.append(child)
  }
  return element
}
