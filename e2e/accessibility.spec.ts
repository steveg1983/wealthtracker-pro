import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pages to test for accessibility
const PAGES = [
  { name: 'Dashboard', path: '/' },
  { name: 'Transactions', path: '/transactions' },
  { name: 'Accounts', path: '/accounts' },
  { name: 'Budget', path: '/budget' },
  { name: 'Goals', path: '/goals' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'Settings', path: '/settings' }
];

test.describe('Accessibility Tests', () => {
  // Test each page for accessibility violations
  PAGES.forEach(({ name, path }) => {
    test(`${name} page should have no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      
      // Wait for content to load
      await page.waitForLoadState('networkidle');
      
      // Run accessibility scan
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      
      // Log violations for debugging
      if (accessibilityScanResults.violations.length > 0) {
        console.log(`\n❌ ${name} page violations:`);
        accessibilityScanResults.violations.forEach(violation => {
          console.log(`  - [${violation.impact}] ${violation.id}: ${violation.description}`);
          console.log(`    ${violation.helpUrl}`);
          console.log(`    Affected elements: ${violation.nodes.length}`);
        });
      }
      
      // Assert no violations
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Color Contrast Checks', () => {
    test('Financial amounts should have sufficient contrast', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for negative amounts (red text)
      const negativeAmounts = await page.$$('.text-red-500, .text-red-600');
      if (negativeAmounts.length > 0) {
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('.text-red-500, .text-red-600')
          .withTags(['wcag2aa'])
          .analyze();
        
        const contrastViolations = accessibilityScanResults.violations.filter(
          v => v.id === 'color-contrast'
        );
        
        expect(contrastViolations).toHaveLength(0);
      }
      
      // Check for positive amounts (green text)
      const positiveAmounts = await page.$$('.text-green-500, .text-green-600');
      if (positiveAmounts.length > 0) {
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('.text-green-500, .text-green-600')
          .withTags(['wcag2aa'])
          .analyze();
        
        const contrastViolations = accessibilityScanResults.violations.filter(
          v => v.id === 'color-contrast'
        );
        
        expect(contrastViolations).toHaveLength(0);
      }
    });
    
    test('Table headers should have sufficient contrast', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');
      
      // Check table headers with bg-secondary class
      const tableHeaders = await page.$$('.bg-secondary th');
      if (tableHeaders.length > 0) {
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('.bg-secondary')
          .withTags(['wcag2aa'])
          .analyze();
        
        const contrastViolations = accessibilityScanResults.violations.filter(
          v => v.id === 'color-contrast'
        );
        
        if (contrastViolations.length > 0) {
          console.log('\n⚠️  Table header contrast issue detected!');
          console.log('White text on #8EA9DB background may not meet WCAG standards');
        }
        
        expect(contrastViolations).toHaveLength(0);
      }
    });
  });

  test.describe('Interactive Elements', () => {
    test('Add Transaction Modal should be accessible', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Open Add Transaction modal
      const addButton = page.getByRole('button', { name: /add transaction/i });
      await addButton.click();
      
      // Wait for modal
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });
      
      // Run accessibility scan on modal
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2aa'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
      
      // Check specific modal features
      const modal = page.locator('[role="dialog"]');
      
      // Check modal has title
      const modalTitle = await modal.getAttribute('aria-label');
      expect(modalTitle).toBeTruthy();
      
      // Check form fields have labels
      const inputs = await modal.locator('input, select, textarea').all();
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        if (id) {
          const label = await page.$(`label[for="${id}"]`);
          const ariaLabel = await input.getAttribute('aria-label');
          expect(label || ariaLabel).toBeTruthy();
        }
      }
      
      // Close modal
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('Skip links should be functional', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Press tab to reveal skip links
      await page.keyboard.press('Tab');
      
      // Check if skip link is visible and focused
      const skipLink = page.locator('a:has-text("Skip to main content")');
      await expect(skipLink).toBeVisible();
      await expect(skipLink).toBeFocused();
      
      // Activate skip link
      await page.keyboard.press('Enter');
      
      // Verify focus moved to main content
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBe('MAIN');
    });
    
    test('Modal focus trap should work', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Open a modal
      const addButton = page.getByRole('button', { name: /add transaction/i });
      await addButton.click();
      
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });
      
      // Tab through modal elements
      let tabCount = 0;
      const maxTabs = 20; // Prevent infinite loop
      
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');
        tabCount++;
        
        // Check if focus is still within modal
        const focusedElement = await page.evaluate(() => {
          const active = document.activeElement;
          const modal = document.querySelector('[role="dialog"]');
          return modal?.contains(active);
        });
        
        expect(focusedElement).toBeTruthy();
        
        // Check if we've cycled back to the first element
        const currentFocus = await page.evaluate(() => document.activeElement?.className);
        if (tabCount > 5 && currentFocus?.includes('close')) {
          break; // Focus has cycled
        }
      }
    });
  });

  test.describe('Screen Reader Announcements', () => {
    test('Form errors should be announced', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Open Add Transaction modal
      const addButton = page.getByRole('button', { name: /add transaction/i });
      await addButton.click();
      
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });
      
      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /save|add|submit/i });
      await submitButton.click();
      
      // Check for error messages with role="alert"
      const alerts = await page.$$('[role="alert"]');
      expect(alerts.length).toBeGreaterThan(0);
      
      // Verify errors are associated with fields
      const errorMessages = await page.$$('[id$="-error"]');
      for (const error of errorMessages) {
        const errorId = await error.getAttribute('id');
        const fieldWithError = await page.$(`[aria-describedby="${errorId}"]`);
        expect(fieldWithError).toBeTruthy();
      }
    });
  });
});

// Generate accessibility report
test.afterAll(async () => {
  console.log('\n📊 Accessibility Test Summary');
  console.log('================================');
  console.log('Run "npm run test:e2e -- e2e/accessibility.spec.ts" to execute these tests');
  console.log('\nFor detailed manual testing, use:');
  console.log('- ACCESSIBILITY_TEST_RESULTS.md');
  console.log('- ACCESSIBILITY_TESTING_QUICK_START.md');
});