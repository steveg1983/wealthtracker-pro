/**
 * Accessibility testing setup for Vitest
 * Configures vitest-axe for WCAG 2.1 AA compliance testing
 */

import { expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers';
import { configureAxe } from 'vitest-axe';

// Extend Vitest matchers with axe accessibility matchers
expect.extend(matchers);

// Configure axe for WCAG 2.1 AA compliance
export const axeConfig = configureAxe({
  rules: {
    // WCAG 2.1 AA rules
    'color-contrast': { enabled: true },
    'label': { enabled: true },
    'button-name': { enabled: true },
    'image-alt': { enabled: true },
    'link-name': { enabled: true },
    'region': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
    
    // Disable rules that may not apply to all components
    'document-title': { enabled: false }, // Component tests don't have document
    'html-has-lang': { enabled: false }, // Component tests don't have html element
    'landmark-unique': { enabled: false }, // May have multiple in component tests
  },
  // Check for WCAG 2.1 Level AA compliance
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
  }
});

// Helper to format axe violations for better error messages
export function formatViolations(violations: any[]): string {
  return violations
    .map(violation => {
      const nodes = violation.nodes
        .map((node: any) => `  - ${node.html}`)
        .join('\n');
      
      return `
Rule: ${violation.id}
Impact: ${violation.impact}
Description: ${violation.description}
Help: ${violation.help}
Help URL: ${violation.helpUrl}
Affected nodes:
${nodes}`;
    })
    .join('\n\n');
}