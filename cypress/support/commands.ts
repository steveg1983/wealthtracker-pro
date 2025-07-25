/// <reference types="cypress" />

// ***********************************************
// This file contains custom commands for Cypress.
// For more comprehensive examples of custom commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login programmatically
       * @example cy.login('test@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>;
      
      /**
       * Custom command to logout
       * @example cy.logout()
       */
      logout(): Chainable<void>;
      
      /**
       * Custom command to create a test transaction
       * @example cy.createTransaction({ description: 'Test', amount: 100 })
       */
      createTransaction(transaction: {
        description: string;
        amount: number;
        date?: string;
        category?: string;
        type?: 'income' | 'expense';
      }): Chainable<void>;
      
      /**
       * Custom command to wait for data to load
       * @example cy.waitForDataLoad()
       */
      waitForDataLoad(): Chainable<void>;
      
      /**
       * Custom command to check accessibility
       * @example cy.checkA11y()
       */
      checkA11y(context?: any, options?: any): Chainable<void>;
    }
  }
}

// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  // Visit login page if not already there
  cy.url().then((url) => {
    if (!url.includes('/login')) {
      cy.visit('/login');
    }
  });
  
  // Fill in login form
  cy.get('input[type="email"], input[name="email"]').clear().type(email);
  cy.get('input[type="password"], input[name="password"]').clear().type(password);
  
  // Submit form
  cy.get('button[type="submit"]').contains(/sign in|log in/i).click();
  
  // Wait for redirect to dashboard
  cy.url().should('include', '/dashboard');
  
  // Wait for data to load
  cy.waitForDataLoad();
});

// Logout command
Cypress.Commands.add('logout', () => {
  // Click user menu or logout button
  cy.get('[data-testid="user-menu"], [aria-label="User menu"]').click();
  cy.get('button').contains(/log out|sign out/i).click();
  
  // Verify redirect to login page
  cy.url().should('include', '/login');
});

// Create transaction command
Cypress.Commands.add('createTransaction', (transaction) => {
  const {
    description,
    amount,
    date = new Date().toISOString().split('T')[0],
    category = 'Uncategorized',
    type = 'expense'
  } = transaction;
  
  // Navigate to transactions page
  cy.visit('/transactions');
  
  // Click add transaction button
  cy.get('button').contains(/add transaction/i).click();
  
  // Fill in transaction form
  cy.get('input[name="description"], input[placeholder*="description"]').clear().type(description);
  cy.get('input[name="amount"], input[placeholder*="amount"]').clear().type(amount.toString());
  cy.get('input[type="date"], input[name="date"]').clear().type(date);
  
  // Select category
  cy.get('select[name="category"], [data-testid="category-select"]').select(category);
  
  // Select type if there's a toggle
  if (type === 'income') {
    cy.get('button[data-testid="income-toggle"], label[for="income"]').click();
  }
  
  // Submit form
  cy.get('button[type="submit"]').contains(/save|add/i).click();
  
  // Wait for transaction to be saved
  cy.contains(description).should('be.visible');
});

// Wait for data load command
Cypress.Commands.add('waitForDataLoad', () => {
  // Wait for loading indicators to disappear
  cy.get('[data-testid="loading"], .loading, .spinner', { timeout: 10000 }).should('not.exist');
  
  // Wait for skeleton screens to disappear
  cy.get('.skeleton, [data-skeleton]', { timeout: 10000 }).should('not.exist');
  
  // Wait a bit for any animations to complete
  cy.wait(500);
});

// Accessibility check command (requires cypress-axe)
Cypress.Commands.add('checkA11y', (context, options) => {
  // This is a placeholder for accessibility testing
  // To use this, you would need to install cypress-axe:
  // npm install --save-dev cypress-axe
  // Then import it in e2e.ts:
  // import 'cypress-axe'
  
  // For now, we'll do basic accessibility checks
  cy.get('img').each(($img) => {
    cy.wrap($img).should('have.attr', 'alt');
  });
  
  cy.get('button').each(($button) => {
    cy.wrap($button).should('be.visible').and('not.be.disabled');
  });
});

// Prevent TypeScript errors
export {};