/* eslint-disable antfu/no-top-level-await -- Register fixtures before capture CLI starts. */
if (process.argv[1]?.endsWith('/capture.mjs')) {
  const { screens } = await import('../screens.mjs')
  const { expect } = await import('../capture-actions.mjs')
  for (const [name, column] of [['comments-fixture', -1], ['comments-thread', 1], ['comments-details', 2], ['comments-questions', 0]]) {
    screens.push({
      name,
      path: '/__comments09/',
      canvas: false,
      /** Isolate each real component group so narrow captures cover the full fixture. */
      async setup(page) {
        await expect(page.locator('.agent-markdown strong').first()).toBeVisible()
        if (column >= 0) {
          await page.evaluate((column) => {
            const row = document.querySelector('.histoire-shell-layout > div')
            for (const [index, child] of [...row.children].entries()) {
              if (index !== column) child.style.display = 'none'
            }
          }, column)
        }
        if (column === 1) {
          await page.getByRole('region', { name: 'Plan decision' }).getByRole('button').click()
          await page.locator('section[aria-label="Comment conversation"] > div').first().evaluate(element => element.scrollTop = 0)
        }
        if (column === 0) {
          await page.getByLabel('Agent question').getByLabel('Other…').check()
          await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeFocused()
        }
      },
    })
  }
}
