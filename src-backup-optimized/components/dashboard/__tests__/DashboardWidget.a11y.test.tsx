/**
 * Accessibility smoke test for DashboardWidget component
 * Tests WCAG 2.1 AA compliance for dashboard widgets
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import DashboardWidget from '../../DashboardWidget';
import { axeConfig, formatViolations } from '../../../test/setup/a11y';

describe('DashboardWidget - Accessibility', () => {
  const mockWidget = {
    id: 'test-widget',
    type: 'summary' as const,
    title: 'Account Summary',
    position: { x: 0, y: 0, w: 4, h: 2 },
    isVisible: true,
  };

  it('should have no accessibility violations with basic widget', async () => {
    const { container } = render(
      <DashboardWidget
        widget={mockWidget}
        onRemove={() => {}}
        onEdit={() => {}}
      >
        <div>Widget content</div>
      </DashboardWidget>
    );

    const results = await axe(container, axeConfig);
    
    if (results.violations.length > 0) {
      console.error('Accessibility violations found:', formatViolations(results.violations));
    }
    
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', async () => {
    const { container } = render(
      <DashboardWidget
        widget={mockWidget}
        onRemove={() => {}}
        onEdit={() => {}}
      >
        <h3>Subheading</h3>
        <p>Content goes here</p>
      </DashboardWidget>
    );

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should have accessible action buttons', async () => {
    const { container } = render(
      <DashboardWidget
        widget={mockWidget}
        onRemove={() => {}}
        onEdit={() => {}}
        showActions
      >
        <div>Widget with actions</div>
      </DashboardWidget>
    );

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should maintain accessibility in loading state', async () => {
    const { container } = render(
      <DashboardWidget
        widget={mockWidget}
        onRemove={() => {}}
        onEdit={() => {}}
        isLoading
      >
        <div>Loading content...</div>
      </DashboardWidget>
    );

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels for interactive elements', async () => {
    const { container } = render(
      <DashboardWidget
        widget={{
          ...mockWidget,
          isDraggable: true,
          isResizable: true,
        }}
        onRemove={() => {}}
        onEdit={() => {}}
        onResize={() => {}}
        onDrag={() => {}}
      >
        <div>Interactive widget</div>
      </DashboardWidget>
    );

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should maintain contrast in different themes', async () => {
    // Test with dark theme class
    document.documentElement.classList.add('dark');
    
    const { container } = render(
      <DashboardWidget
        widget={mockWidget}
        onRemove={() => {}}
        onEdit={() => {}}
      >
        <div>Dark theme widget</div>
      </DashboardWidget>
    );

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
    
    // Clean up
    document.documentElement.classList.remove('dark');
  });
});