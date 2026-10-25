import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchErrorHandler } from '../../../histoire-app/src/app/standalone/error-handler.js'

/** Lazy workbench chunks that failed to fetch reload the workbench instead of leaving it broken. */
describe('createWorkbenchErrorHandler', () => {
  it('reloads on failed module fetches and logs other errors', () => {
    const reload = vi.fn(() => true)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handle = createWorkbenchErrorHandler({ __histoireEntryFailed: reload } as any)

    handle(new TypeError('Failed to fetch dynamically imported module: http://localhost/Panel.js'))
    expect(reload).toHaveBeenCalledOnce()
    expect(log).not.toHaveBeenCalled()

    const thrown = new Error('Boom')
    handle(thrown)
    expect(log).toHaveBeenCalledWith(thrown)
    // Without the guard (static books) or once it is exhausted, failures are logged.
    reload.mockReturnValue(false)
    handle(new TypeError('Importing a module script failed.'))
    expect(log).toHaveBeenCalledTimes(2)
    log.mockRestore()
  })
})
