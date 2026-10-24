// @vitest-environment node
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { formatCollectCrash, formatThrown, toCloneableError } from '../collect/errors.js'

/** jsdom DOMExceptions are not native errors, so worker messaging clones them to `{}`. */
function createJsdomDomException() {
  const dom = new JSDOM('', { url: 'http://localhost:3000' })
  try {
    // eslint-disable-next-line no-new
    new dom.window.WebSocket('/api/ws')
  }
  catch (e) {
    return e
  }
  finally {
    dom.window.close()
  }
  throw new Error('Expected jsdom to reject the relative WebSocket URL')
}

describe('formatThrown', () => {
  it('describes values without a stack', () => {
    expect(formatThrown({ code: 'E_FAIL' })).toContain(`code: 'E_FAIL'`)
    expect(formatThrown('boom')).toContain('boom')
    expect(formatThrown(undefined)).toBe('undefined')
  })
})

describe('toCloneableError', () => {
  it('keeps non-native errors readable after crossing worker messaging', () => {
    const cloned = structuredClone(toCloneableError(createJsdomDomException()))
    expect(cloned.stack).toContain(`SyntaxError: The URL '/api/ws' is invalid.`)
  })

  it('wraps plain thrown values', () => {
    const cloned = structuredClone(toCloneableError({ code: 'E_FAIL' }))
    expect(cloned.stack).toBe(`Error: { code: 'E_FAIL' }`)
  })
})

describe('formatCollectCrash', () => {
  it('names the story file', () => {
    const message = formatCollectCrash(createJsdomDomException(), 'src/Modal.story.vue')
    expect(message).toContain('Uncaught error while collecting story src/Modal.story.vue')
    expect(message).toContain(`The URL '/api/ws' is invalid.`)
  })
})
