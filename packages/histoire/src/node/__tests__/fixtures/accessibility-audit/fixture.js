import { scanAccessibility } from '../../../runtime/inspection/accessibility.ts'

const root = document.getElementById('story')
let release
let pending
let controller
let active = true
window.fixture = {
  scan: selector => scanAccessibility(root, selector, { loadAxe: () => Promise.resolve(window.axe), isActive: () => true }),
  repair: () => document.getElementById('story-image').setAttribute('alt', 'Story image'),
  startHeld: (timeoutMs) => {
    controller = new AbortController()
    active = true
    pending = scanAccessibility(root, undefined, { loadAxe: () => new Promise((resolve) => {
      release = () => resolve(window.axe)
    }), isActive: () => active, signal: controller.signal, timeoutMs }).then(() => 'success', error => error.code)
  },
  cancel: () => controller.abort(),
  result: () => pending,
  release: () => release(),
  retire: () => { active = false },
  missingEngine: () => scanAccessibility(root, undefined, { loadAxe: () => Promise.reject(new Error('engine absent')), isActive: () => true }).then(() => 'success', error => error.code),
}
