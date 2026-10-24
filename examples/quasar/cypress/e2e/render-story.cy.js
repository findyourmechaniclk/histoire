/// <reference types="cypress" />

describe('Story render', () => {
  it('should render Quasar components with Quasar styles', () => {
    cy.visit('/story/src-components-qbtn-story-vue?variantId=_default')
    cy.getPreviewIframeBody().find('.q-btn').should('have.class', 'bg-primary').contains('Click me')
  })

  it('should run boot files and install the project store', () => {
    cy.visit('/story/src-components-greetingcard-story-vue?variantId=src-components-greetingcard-story-vue-0')
    cy.getPreviewIframeBody().find('[data-testid="greeting"]').contains('Hello from a Quasar boot file')
    cy.getPreviewIframeBody().find('[data-testid="count"]').click().contains('Count: 1')
  })

  it('should load App Extension boot files and framework plugins', () => {
    cy.visit('/story/src-components-greetingcard-story-vue?variantId=src-components-greetingcard-story-vue-0')
    cy.getPreviewIframeBody().find('[data-testid="extension-message"]').contains('Hello from an App Extension')
    cy.getPreviewIframeBody().find('[data-testid="info"]').click()
    cy.getPreviewIframeBody().find('.q-dialog').contains('Dialog plugin from an App Extension')
  })
})
