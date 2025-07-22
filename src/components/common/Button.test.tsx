/**
 * Button Component Tests
 * Comprehensive tests for the Button UI component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { PlusIcon, SaveIcon } from '../icons';

describe('Button', () => {
  describe('basic rendering', () => {
    it('renders with children text', () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('Click Me');
    });

    it('renders as a button element', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('applies default variant and size classes', () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole('button');
      
      // Should have primary variant classes
      expect(button.className).toContain('bg-[var(--color-interactive-primary)]');
      expect(button.className).toContain('text-white');
      
      // Should have md size classes
      expect(button.className).toContain('px-[var(--spacing-4)]');
      expect(button.className).toContain('py-[var(--spacing-2)]');
    });
  });

  describe('variants', () => {
    it('renders primary variant', () => {
      render(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('bg-[var(--color-interactive-primary)]');
      expect(button.className).toContain('text-white');
    });

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('bg-[var(--color-surface-secondary)]');
      expect(button.className).toContain('text-[var(--color-text-primary)]');
      expect(button.className).toContain('border');
    });

    it('renders danger variant', () => {
      render(<Button variant="danger">Delete</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('bg-[var(--color-status-error)]');
      expect(button.className).toContain('text-white');
    });

    it('renders success variant', () => {
      render(<Button variant="success">Confirm</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('bg-[var(--color-status-success)]');
      expect(button.className).toContain('text-white');
    });

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('bg-transparent');
      expect(button.className).toContain('text-[var(--color-text-primary)]');
    });
  });

  describe('sizes', () => {
    it('renders small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('px-[var(--spacing-3)]');
      expect(button.className).toContain('py-[var(--spacing-1-5)]');
      expect(button.className).toContain('text-[var(--font-size-sm)]');
    });

    it('renders medium size', () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('px-[var(--spacing-4)]');
      expect(button.className).toContain('py-[var(--spacing-2)]');
      expect(button.className).toContain('text-[var(--font-size-base)]');
    });

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('px-[var(--spacing-6)]');
      expect(button.className).toContain('py-[var(--spacing-3)]');
      expect(button.className).toContain('text-[var(--font-size-lg)]');
    });
  });

  describe('fullWidth', () => {
    it('renders full width when prop is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).toContain('w-full');
    });

    it('does not render full width by default', () => {
      render(<Button>Normal Width</Button>);
      const button = screen.getByRole('button');
      
      expect(button.className).not.toContain('w-full');
    });
  });

  describe('icons', () => {
    it('renders with left icon', () => {
      render(
        <Button leftIcon={PlusIcon}>
          Add Item
        </Button>
      );
      
      expect(screen.getByRole('button')).toHaveTextContent('Add Item');
      // Icon should be rendered
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Check that icon has the proper attributes
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
    });

    it('renders with right icon', () => {
      render(
        <Button rightIcon={SaveIcon}>
          Save
        </Button>
      );
      
      expect(screen.getByRole('button')).toHaveTextContent('Save');
      // Icon should be rendered
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Check that icon has the proper attributes
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
    });

    it('renders with both left and right icons', () => {
      render(
        <Button leftIcon={PlusIcon} rightIcon={SaveIcon}>
          Action
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Action');
      
      const svgs = button.querySelectorAll('svg');
      expect(svgs).toHaveLength(2);
    });

    it('renders icons with correct size based on button size', () => {
      const { rerender } = render(
        <Button size="sm" leftIcon={PlusIcon}>Small</Button>
      );
      
      let svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveAttribute('width', '14');
      expect(svg).toHaveAttribute('height', '14');
      
      rerender(<Button size="md" leftIcon={PlusIcon}>Medium</Button>);
      svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
      
      rerender(<Button size="lg" leftIcon={PlusIcon}>Large</Button>);
      svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });
  });

  describe('loading state', () => {
    it('shows loading spinner and text when isLoading is true', () => {
      render(<Button isLoading>Submit</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Loading...');
      
      // Should have loading icon
      const loadingIcon = button.querySelector('svg');
      expect(loadingIcon).toBeInTheDocument();
      // The LoadingIcon component should be present
      const animatedElement = button.querySelector('.animate-spin');
      expect(animatedElement).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<Button isLoading>Submit</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('does not render original icons when loading', () => {
      render(
        <Button isLoading leftIcon={PlusIcon} rightIcon={SaveIcon}>
          Submit
        </Button>
      );
      
      const button = screen.getByRole('button');
      // Should only have one svg (the loading spinner)
      const svgs = button.querySelectorAll('svg');
      expect(svgs).toHaveLength(1);
      // Should have the animated element
      const animatedElement = button.querySelector('.animate-spin');
      expect(animatedElement).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('disables button when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('applies disabled styles', () => {
      render(<Button disabled>Disabled</Button>);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('disabled:opacity-50');
      expect(button.className).toContain('disabled:cursor-not-allowed');
    });

    it('prevents click events when disabled', async () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Click Me</Button>);
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    it('handles click events', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard events', async () => {
      const handleKeyDown = vi.fn();
      render(<Button onKeyDown={handleKeyDown}>Press Key</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      await userEvent.keyboard('{Enter}');
      
      expect(handleKeyDown).toHaveBeenCalled();
    });

    it('does not trigger events when loading', async () => {
      const handleClick = vi.fn();
      render(<Button isLoading onClick={handleClick}>Click Me</Button>);
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('custom props and className', () => {
    it('applies custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
    });

    it('forwards additional HTML button props', () => {
      render(
        <Button
          type="submit"
          form="test-form"
          aria-label="Submit form"
          data-testid="submit-btn"
        >
          Submit
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('form', 'test-form');
      expect(button).toHaveAttribute('aria-label', 'Submit form');
      expect(button).toHaveAttribute('data-testid', 'submit-btn');
    });
  });

  describe('focus management', () => {
    it('shows focus ring when focused', () => {
      render(<Button>Focus Me</Button>);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('focus:outline-none');
      expect(button.className).toContain('focus:ring-2');
      expect(button.className).toContain('focus:ring-offset-2');
    });

    it('can be focused programmatically', () => {
      render(<Button>Focus Me</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(document.activeElement).toBe(button);
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes when loading', () => {
      render(<Button isLoading>Submit</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
    });

    it('supports aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>);
      
      const button = screen.getByRole('button', { name: 'Close dialog' });
      expect(button).toBeInTheDocument();
    });

    it('supports aria-describedby', () => {
      render(
        <>
          <Button aria-describedby="help-text">Submit</Button>
          <span id="help-text">Click to submit the form</span>
        </>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'help-text');
    });
  });

  describe('real-world usage', () => {
    it('works as a form submit button', () => {
      const handleSubmit = vi.fn((e) => e.preventDefault());
      
      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit Form</Button>
        </form>
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleSubmit).toHaveBeenCalled();
    });

    it('works with complex content', () => {
      render(
        <Button leftIcon={SaveIcon} variant="success" size="lg">
          <span>Save Changes</span>
          <span className="ml-1 text-sm">(Ctrl+S)</span>
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Save Changes(Ctrl+S)');
    });
  });
});