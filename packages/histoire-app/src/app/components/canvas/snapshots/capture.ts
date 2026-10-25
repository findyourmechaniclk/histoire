/** Static copy of a rendered sandbox document, replayed while its live frame loads. */
export interface FrameSnapshotCapture {
  /** `<html>` attributes (dark class, inline variables). */
  htmlAttributes: Record<string, string>
  /** `<body>` attributes. */
  bodyAttributes: Record<string, string>
  /** Sanitized `<body>` markup. */
  body: string
  /** Text of every stylesheet applied to the document. */
  css: string
}

/** Elements never replayed: executable, invisible, or already part of `css`. */
const REMOVED = new Set(['SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'STYLE', 'LINK'])

/** Reads one attribute list into a plain record. */
function readAttributes(element: Element): Record<string, string> {
  return Object.fromEntries(Array.from(element.attributes, attribute => [attribute.name, attribute.value]))
}

/**
 * Collects the CSS text of every stylesheet. Rules of a stylesheet the
 * document can't read (cross-origin) are replaced by an import of its URL.
 */
function readStyles(document: Document): string {
  const sheets = [...Array.from(document.styleSheets), ...(document.adoptedStyleSheets ?? [])]
  return sheets.map((sheet) => {
    try {
      return Array.from(sheet.cssRules, rule => rule.cssText).join('\n')
    }
    catch {
      return sheet.href ? `@import url(${JSON.stringify(sheet.href)});` : ''
    }
  }).join('\n')
}

/**
 * Carries live state the markup doesn't hold (form values, canvas pixels)
 * onto the cloned element, and strips anything executable.
 * @returns Whether the clone must be removed
 */
function copyElement(source: Element, clone: Element): boolean {
  if (REMOVED.has(source.tagName)) return true
  for (const attribute of Array.from(clone.attributes)) {
    if (attribute.name.startsWith('on') || attribute.name === 'autofocus') clone.removeAttribute(attribute.name)
  }
  // Elements come from the sandbox window: compare tag names, `instanceof`
  // would test against this window's element classes.
  switch (source.tagName) {
    case 'INPUT': {
      const input = source as HTMLInputElement
      clone.setAttribute('value', input.value)
      if (input.checked) clone.setAttribute('checked', '')
      else clone.removeAttribute('checked')
      break
    }
    case 'TEXTAREA':
      clone.textContent = (source as HTMLTextAreaElement).value
      break
    case 'OPTION':
      if ((source as HTMLOptionElement).selected) clone.setAttribute('selected', '')
      else clone.removeAttribute('selected')
      break
    case 'IFRAME':
      // Nested documents would load (and run) for real.
      clone.removeAttribute('src')
      clone.removeAttribute('srcdoc')
      break
    case 'CANVAS':
      try {
        const image = source.ownerDocument.createElement('img')
        image.src = (source as HTMLCanvasElement).toDataURL()
        for (const [name, value] of Object.entries(readAttributes(clone))) image.setAttribute(name, value)
        clone.replaceWith(image)
      }
      catch {
        // Tainted or unsupported canvas: replay it blank.
      }
  }
  return false
}

/**
 * Captures what a sandbox document currently shows, without scripts or event
 * handlers, so it can be replayed in a script-less frame.
 * @param document Same-origin sandbox document, ready and rendered
 */
export function captureFrameSnapshot(document: Document): FrameSnapshotCapture {
  const body = document.body.cloneNode(true) as HTMLElement
  // A deep clone keeps the element order: walk both trees side by side.
  const sources = Array.from(document.body.querySelectorAll('*'))
  const clones = Array.from(body.querySelectorAll('*'))
  const removed: Element[] = []
  for (let index = 0; index < sources.length; index++) {
    if (copyElement(sources[index], clones[index])) removed.push(clones[index])
  }
  for (const element of removed) element.remove()
  for (const attribute of Array.from(body.attributes)) {
    if (attribute.name.startsWith('on')) body.removeAttribute(attribute.name)
  }
  return {
    htmlAttributes: readAttributes(document.documentElement),
    bodyAttributes: readAttributes(body),
    body: body.innerHTML,
    css: readStyles(document),
  }
}
