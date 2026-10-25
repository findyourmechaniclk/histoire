import { describe, expect, it } from 'vitest'
import { captureFrameSnapshot } from '../../../histoire-app/src/app/components/canvas/snapshots/capture.js'
import { renderFrameSnapshot } from '../../../histoire-app/src/app/components/canvas/snapshots/document.js'

/** Sandbox-like document with styles, scripts, handlers and edited form fields. */
function createDocument() {
  // Stylesheets are only parsed in documents with a browsing context.
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const doc = frame.contentDocument!
  doc.documentElement.className = 'dark'
  doc.head.innerHTML = '<style>.card { color: red; }</style><script>window.boot()</script>'
  doc.body.setAttribute('data-theme', 'x')
  doc.body.innerHTML = `
    <div class="card" onclick="steal()">Card<script>evil()</script></div>
    <input id="text" value="initial"><input id="check" type="checkbox">
    <textarea id="area"></textarea>
    <select id="choice"><option>a</option><option>b</option></select>
    <iframe src="/nested.html"></iframe>
    <noscript>no</noscript>`
  ;(doc.getElementById('text') as HTMLInputElement).value = 'typed'
  ;(doc.getElementById('check') as HTMLInputElement).checked = true
  ;(doc.getElementById('area') as HTMLTextAreaElement).value = 'notes'
  ;(doc.getElementById('choice') as HTMLSelectElement).value = 'b'
  return doc
}

describe('canvas frame snapshot', () => {
  it('captures rendered markup without anything executable', () => {
    const doc = createDocument()
    const capture = captureFrameSnapshot(doc)
    expect(capture.css).toContain('.card')
    expect(capture.htmlAttributes).toEqual({ class: 'dark' })
    expect(capture.bodyAttributes).toEqual({ 'data-theme': 'x' })
    expect(capture.body).toContain('Card')
    expect(capture.body).not.toMatch(/<script|onclick|<noscript|nested\.html/)
    // The live document stays untouched.
    expect(doc.querySelector('.card')!.getAttribute('onclick')).toBe('steal()')
  })

  it('keeps edited form state', () => {
    const container = document.createElement('div')
    container.innerHTML = captureFrameSnapshot(createDocument()).body
    expect(container.querySelector<HTMLInputElement>('#text')!.getAttribute('value')).toBe('typed')
    expect(container.querySelector('#check')!.hasAttribute('checked')).toBe(true)
    expect(container.querySelector('#area')!.textContent).toBe('notes')
    expect(container.querySelectorAll('option')[1].hasAttribute('selected')).toBe(true)
  })

  it('renders a standalone document resolving URLs against the sandbox', () => {
    const html = renderFrameSnapshot({ htmlAttributes: { class: 'dark', style: '--a: "x"' }, bodyAttributes: {}, body: '<img src="/a.png">' }, '.a{}</style><script>x()</script>', 'http://localhost:6006/__sandbox.html')
    expect(html).toContain('<html class="dark" style="--a: &quot;x&quot;">')
    expect(html).toContain('<base href="http://localhost:6006/__sandbox.html">')
    expect(html).toContain('<img src="/a.png">')
    // CSS text can't close its own style element.
    expect(html).not.toContain('</style><script>')
  })
})
