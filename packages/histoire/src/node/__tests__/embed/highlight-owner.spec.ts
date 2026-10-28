// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { createRuntimeHighlight } from '../../virtual/preview-runtime/highlight.js'

it('binds highlight cleanup to the issuing connection and lease', () => {
  const root = document.createElement('div')
  root.innerHTML = '<button id="first">First</button><button id="second">Second</button>'
  document.body.append(root)
  const highlights = createRuntimeHighlight(document, window)
  const owner = { sessionId: 'session', connectionId: 'first', mountId: 'mount', runtimeId: 'document', target: { storyId: 'story', variantId: 'variant' } }
  try {
    const old = highlights.show(root, '#first', 5000, 'request-1', owner)
    const current = highlights.show(root, '#second', 5000, 'request-2', owner)
    expect(highlights.clear(old, owner)).toBe(false)
    expect(highlights.clear(current, { ...owner, connectionId: 'other' })).toBe(false)
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(1)
    expect(highlights.clear(current, owner)).toBe(true)
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(0)
    highlights.show(root, '#second', 5000, 'request-3', owner, 'highlightLease')
    highlights.revoke({ highlight: true, highlightLease: false })
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(0)
  }
  finally {
    highlights.close()
    root.remove()
  }
})

it('removes an overlay when its rendered target leaves the story root', async () => {
  const root = document.createElement('div')
  root.innerHTML = '<button>Component</button>'
  document.body.append(root)
  const highlights = createRuntimeHighlight(document, window)
  try {
    const target = root.querySelector('button')!
    highlights.showElement(root, target, 5000, 'request', {})
    target.remove()
    await vi.waitFor(() => expect(document.querySelector('[data-histoire-inspection-highlight]')).toBeNull())
  }
  finally {
    highlights.close()
    root.remove()
  }
})

it('preserves a successor installed during a reentrant geometry read', () => {
  const root = document.createElement('div')
  root.innerHTML = '<button id="first">First</button><button id="second">Second</button>'
  document.body.append(root)
  const highlights = createRuntimeHighlight(document, window)
  const owner = { runtimeId: 'document' }
  try {
    const target = root.querySelector<HTMLButtonElement>('#first')!
    const read = target.getBoundingClientRect.bind(target)
    let successor = ''
    target.getBoundingClientRect = () => {
      successor = highlights.show(root, '#second', 5000, 'successor', owner)
      return read()
    }
    highlights.showElement(root, target, 5000, 'predecessor', owner)
    highlights.cancel('predecessor', owner)
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(1)
    expect(highlights.clear(successor, owner)).toBe(true)
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(0)
  }
  finally {
    highlights.close()
    root.remove()
  }
})

it('retires a component overlay when its active ownership check fails', async () => {
  const root = document.createElement('div')
  root.innerHTML = '<button>Component</button>'
  document.body.append(root)
  const highlights = createRuntimeHighlight(document, window)
  try {
    highlights.showElement(root, root.querySelector('button')!, 5000, 'request', {}, 'highlight', () => {
      throw new Error('Owner retired')
    })
    await vi.waitFor(() => expect(document.querySelector('[data-histoire-inspection-highlight]')).toBeNull())
    highlights.show(root, 'button', 5000, 'successor', {})
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(1)
  }
  finally {
    highlights.close()
    root.remove()
  }
})

it('revokes only component highlights when component permission is withdrawn', () => {
  const root = document.createElement('div')
  root.innerHTML = '<button id="component">Component</button><button id="selector">Selector</button>'
  document.body.append(root)
  const highlights = createRuntimeHighlight(document, window)
  const owner = { runtimeId: 'document' }
  try {
    const component = root.querySelector('#component')!
    highlights.showElement(root, component, 5000, 'component-request', owner)
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(1)
    highlights.revoke({ highlight: true, highlightLease: true, componentHighlight: false })
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(0)
    highlights.show(root, '#selector', 5000, 'selector-request', owner)
    highlights.revoke({ highlight: true, highlightLease: true, componentHighlight: false })
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(1)
    component.remove()
    expect(() => highlights.showElement(root, component, 5000, 'stale-request', owner)).toThrow('Highlight target unavailable')
    expect(document.querySelectorAll('[data-histoire-inspection-highlight]')).toHaveLength(1)
  }
  finally {
    highlights.close()
    root.remove()
  }
})
