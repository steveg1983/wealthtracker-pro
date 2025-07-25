// ***********************************************************
// This file is processed and loaded automatically before
// your component test files.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
// ***********************************************************

// Import commands.js
import './commands'

// Import global styles
import '../../src/index.css'

// Import mount from cypress/react
import { mount } from 'cypress/react18'

// Augment the Cypress namespace to include type definitions for
// your custom command.
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

// Add mount command
Cypress.Commands.add('mount', mount)

// Custom component test commands
Cypress.Commands.add('mockAuth', () => {
  // Mock authentication for component tests
  window.localStorage.setItem('auth-token', 'mock-token');
  window.localStorage.setItem('user', JSON.stringify({
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User'
  }));
});

// Mock API responses for component tests
Cypress.Commands.add('mockApiResponses', () => {
  cy.intercept('GET', '**/api/transactions', {
    statusCode: 200,
    body: {
      transactions: [
        {
          id: '1',
          description: 'Test Transaction',
          amount: 100,
          date: '2025-07-23',
          category: 'Shopping'
        }
      ]
    }
  });
  
  cy.intercept('GET', '**/api/accounts', {
    statusCode: 200,
    body: {
      accounts: [
        {
          id: '1',
          name: 'Checking Account',
          balance: 5000,
          type: 'checking'
        }
      ]
    }
  });
});