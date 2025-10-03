# Cypress E2E and Component Tests

This directory contains Cypress end-to-end (E2E) and component tests for the Wealth Tracker application.

## Structure

```
cypress/
├── e2e/                    # End-to-end test files
│   ├── dashboard.cy.ts     # Dashboard user journey tests
│   ├── transactions.cy.ts  # Transaction management tests
│   └── import.cy.ts        # Import functionality tests
├── fixtures/               # Test data files
├── support/                # Support files and custom commands
│   ├── commands.ts         # Custom Cypress commands
│   ├── component.ts        # Component testing setup
│   └── e2e.ts             # E2E testing setup
└── README.md              # This file
```

## Running Tests

### Prerequisites

First, install Cypress and its dependencies:

```bash
npm install --save-dev cypress @cypress/react @cypress/webpack-dev-server
```

### E2E Tests

```bash
# Open Cypress Test Runner (interactive mode)
npm run cypress

# Run all tests in headless mode
npm run cypress:run

# Run tests in headless mode with Chrome
npm run cypress:headless
```

### Component Tests

```bash
# Open Component Test Runner
npm run cypress:component
```

## Custom Commands

We've implemented several custom commands to make testing easier:

### `cy.login(email, password)`
Logs in a user programmatically.

```typescript
cy.login('test@example.com', 'password123');
```

### `cy.logout()`
Logs out the current user.

```typescript
cy.logout();
```

### `cy.createTransaction(transaction)`
Creates a new transaction with the specified details.

```typescript
cy.createTransaction({
  description: 'Coffee',
  amount: 4.50,
  date: '2025-07-23',
  category: 'Food & Dining'
});
```

### `cy.waitForDataLoad()`
Waits for all loading indicators to disappear.

```typescript
cy.visit('/dashboard');
cy.waitForDataLoad();
```

### `cy.checkA11y()`
Performs basic accessibility checks.

```typescript
cy.checkA11y();
```

## Writing New Tests

### E2E Test Example

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    cy.visit('/feature-page');
    cy.waitForDataLoad();
  });

  it('should perform user action', () => {
    // Arrange
    cy.login('test@example.com', 'password');
    
    // Act
    cy.get('button').contains('Action').click();
    
    // Assert
    cy.contains('Expected Result').should('be.visible');
  });
});
```

### Component Test Example

```typescript
describe('ComponentName', () => {
  it('renders correctly', () => {
    cy.mount(
      <MemoryRouter>
        <ComponentName prop="value" />
      </MemoryRouter>
    );
    
    cy.contains('Expected Text').should('be.visible');
  });
});
```

## Best Practices

1. **Use data-testid attributes**: Add `data-testid` attributes to elements for reliable selection.

2. **Wait for data**: Always use `cy.waitForDataLoad()` after navigation to ensure data has loaded.

3. **Test user journeys**: Focus on complete user workflows rather than isolated actions.

4. **Handle async operations**: Use Cypress's built-in retry-ability instead of fixed waits.

5. **Mock external dependencies**: Use `cy.intercept()` to mock API calls for consistent tests.

## Environment Configuration

The tests use the following environment variables:

- `CYPRESS_baseUrl`: Base URL for the application (default: http://localhost:5173)
- `CYPRESS_apiUrl`: API URL (default: http://localhost:3000)
- `CYPRESS_testUser`: Test user credentials

## CI/CD Integration

Tests are automatically run in CI using GitHub Actions. See `.github/workflows/cypress.yml` for configuration.

## Debugging

1. **Screenshots**: Failed tests automatically capture screenshots in `cypress/screenshots/`

2. **Videos**: Test runs are recorded in `cypress/videos/` (disabled by default, enable in `cypress.config.ts`)

3. **Debug mode**: Run `npx cypress open` to use the interactive test runner

4. **Console logs**: Custom console capture is enabled - check the Cypress command log

## Common Issues

### Tests timing out
- Increase timeout in `cypress.config.ts`
- Check if the dev server is running
- Verify API endpoints are accessible

### Element not found
- Use `data-testid` attributes
- Check if element is within viewport
- Ensure data has loaded with `cy.waitForDataLoad()`

### Flaky tests
- Avoid fixed waits (`cy.wait(1000)`)
- Use proper assertions that wait for conditions
- Mock time-dependent features