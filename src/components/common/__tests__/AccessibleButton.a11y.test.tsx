/**
 * Accessibility smoke test for AccessibleButton component
 * Tests WCAG 2.1 AA compliance
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import AccessibleButton from '../AccessibleButton';
import { axeConfig, formatViolations } from '../../../test/setup/a11y';

describe('AccessibleButton - Accessibility', () => {
  it('should have no accessibility violations with text content', async () => {
    const { container } = render(
      <AccessibleButton onClick={() => {}}>
        Click me
      </AccessibleButton>
    );

    const results = await axe(container, axeConfig);
    
    if (results.violations.length > 0) {
      console.error('Accessibility violations found:', formatViolations(results.violations));
    }
    
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when disabled', async () => {
    const { container } = render(
      <AccessibleButton onClick={() => {}} disabled>
        Disabled Button
      </AccessibleButton>
    );

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should have proper aria-label for icon-only button', async () => {
    const { container } = render(
      <AccessibleButton onClick={() => {}} aria-label="Delete item">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 8L4 4M8 8L12 12" />
        </svg>
      </AccessibleButton>
    );

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with loading state', async () => {
    const { container } = render(
      <AccessibleButton onClick={() => {}} isLoading>
        Loading...
      </AccessibleButton>
    );

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should maintain contrast ratios in different variants', async () => {
    const variants = ['primary', 'secondary', 'danger', 'success'];
    
    for (const variant of variants) {
      const { container } = render(
        <AccessibleButton onClick={() => {}} variant={variant}>
          {variant} Button
        </AccessibleButton>
      );

      const results = await axe(container, axeConfig);
      expect(results).toHaveNoViolations();
    }
  });
});