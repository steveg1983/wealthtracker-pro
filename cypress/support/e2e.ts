// ***********************************************************
// This file is processed and loaded automatically before test files.
// You can change the location of this file or turn off processing
// cypress/support/e2e.ts
// ***********************************************************

// Import commands.ts
import './commands';

// Custom error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  // You might want to log the error or handle specific errors differently
  console.error('Uncaught exception:', err);
  
  // Ignore ResizeObserver errors which are common in modern web apps
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  
  // Ignore React hydration errors in development
  if (err.message.includes('Hydration failed') || err.message.includes('There was an error while hydrating')) {
    return false;
  }
  
  // Let other errors fail the test
  return true;
});

// Add custom console log capture
Cypress.on('window:before:load', (win) => {
  // Capture console.log, console.error, etc.
  const originalLog = win.console.log;
  const originalError = win.console.error;
  const originalWarn = win.console.warn;

  win.console.log = (...args) => {
    originalLog.apply(win.console, args);
    Cypress.log({
      name: 'console.log',
      message: args,
    });
  };

  win.console.error = (...args) => {
    originalError.apply(win.console, args);
    Cypress.log({
      name: 'console.error',
      message: args,
      consoleProps: () => ({ args }),
    });
  };

  win.console.warn = (...args) => {
    originalWarn.apply(win.console, args);
    Cypress.log({
      name: 'console.warn',
      message: args,
    });
  };
});

// Global before each hook
beforeEach(() => {
  // Clear localStorage before each test
  cy.clearLocalStorage();
  
  // Clear cookies
  cy.clearCookies();
  
  // Set up common test data
  cy.task('log', `Starting test: ${Cypress.currentTest.title}`);
});

// Global after each hook
afterEach(() => {
  cy.task('log', `Completed test: ${Cypress.currentTest.title}`);
});