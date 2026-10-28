import { expect, it } from 'vitest'
import { launchEmbedBrowser } from '../../../histoire/src/node/__tests__/utils/embed/browser.js'
import { createInspectionReport } from '../report/index.js'
import { reportDom, reportSecret, reportVariant } from './fixtures/report.js'

it('renders historical summaries offline without executing content or requesting resources', async () => {
  const { html } = createInspectionReport({
    results: [reportVariant, reportDom],
    content: {
      selections: [{ index: 0, stateKeys: ['markup'] }, { index: 1, nodeIndexes: [0] }],
      sanitize: value => typeof value === 'string' ? value.replaceAll(reportSecret, '[redacted]') : value,
    },
  })
  const browser = await launchEmbedBrowser()
  try {
    const context = await browser.newContext({ offline: true })
    try {
      const page = await context.newPage()
      const requests: string[] = []
      page.on('request', request => requests.push(request.url()))
      await page.setContent(html)
      expect(await page.locator('h1').textContent()).toBe('Historical inspection')
      expect(await page.locator('tbody tr').count()).toBe(2)
      expect(await page.locator('body').textContent()).toContain('2 state fields')
      const body = await page.locator('body').textContent()
      expect(body).toContain('<script>alert(1)</script>')
      expect(body).toContain('<img src=x onerror=alert(1)>[redacted]')
      expect(body).not.toContain(reportSecret)
      expect(body).not.toContain('token')
      expect(await page.locator('script, img, a, form, button').count()).toBe(0)
      expect(requests).toEqual([])
    }
    finally { await context.close() }
  }
  finally { await browser.close() }
}, 30_000)
