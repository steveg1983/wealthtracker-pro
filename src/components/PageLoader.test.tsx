/**
 * PageLoader Tests
 * Tests for the page loading spinner component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageLoader from './PageLoader';

describe('PageLoader', () => {
  describe('Basic Rendering', () => {
    it('renders loading text', () => {
      render(<PageLoader />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders spinner element', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('has correct container structure', () => {
      const { container } = render(<PageLoader />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center', 'min-h-[400px]');
      
      const innerContainer = wrapper?.firstChild;
      expect(innerContainer).toHaveClass('text-center');
    });
  });

  describe('Spinner Styling', () => {
    it('applies correct spinner classes', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass(
        'animate-spin',
        'rounded-full',
        'h-12',
        'w-12',
        'border-b-2',
        'border-primary',
        'mx-auto',
        'mb-4'
      );
    });

    it('has correct spinner dimensions', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-12', 'w-12');
    });

    // The ring is `border-primary`, not a stock blue (Claude Design's ruling of
    // 28 Aug 2026, executed 29 Aug). The token is what lets ONE class serve both
    // grounds: index.css remaps `.dark .border-primary` to #94a3b8, because the
    // navy that reads on white is invisible on a gray-900 page.
    it('draws its ring in the app’s own token, not a stock blue', () => {
      render(<PageLoader />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-primary');
      expect(spinner?.className).not.toMatch(/blue/);
    });

    it('centers spinner horizontally', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('mx-auto');
    });

    it('has margin bottom for spacing', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('mb-4');
    });
  });

  describe('Text Styling', () => {
    it('applies correct text color classes', () => {
      render(<PageLoader />);
      
      const text = screen.getByText('Loading...');
      expect(text).toHaveClass('text-gray-600', 'dark:text-gray-400');
    });

    it('text is inside paragraph element', () => {
      render(<PageLoader />);
      
      const text = screen.getByText('Loading...');
      expect(text.tagName).toBe('P');
    });
  });

  describe('Layout', () => {
    it('centers content vertically and horizontally', () => {
      const { container } = render(<PageLoader />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('has minimum height for visibility', () => {
      const { container } = render(<PageLoader />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('min-h-[400px]');
    });

    it('text container is centered', () => {
      render(<PageLoader />);
      
      const textContainer = screen.getByText('Loading...').parentElement;
      expect(textContainer).toHaveClass('text-center');
    });

    it('maintains proper hierarchy', () => {
      const { container } = render(<PageLoader />);
      
      // Check DOM structure
      const outerDiv = container.firstChild;
      const innerDiv = outerDiv?.firstChild;
      const spinner = innerDiv?.firstChild;
      const text = innerDiv?.lastChild;
      
      expect(outerDiv).toBeInTheDocument();
      expect(innerDiv).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
      expect(text).toHaveTextContent('Loading...');
    });
  });

  describe('Accessibility', () => {
    it('loading text is readable by screen readers', () => {
      render(<PageLoader />);
      
      const loadingText = screen.getByText('Loading...');
      expect(loadingText).toBeInTheDocument();
      // The text is visible and will be announced by screen readers
    });

    it('could benefit from aria-label on spinner', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      // Note: Component could be improved by adding aria-label="Loading" or role="status"
      expect(spinner).toBeInTheDocument();
    });

    it('could benefit from role status', () => {
      const { container } = render(<PageLoader />);
      
      // Note: Component could be improved by adding role="status" and aria-live="polite"
      // to announce loading state to screen readers
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('spinner has animation class', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('animation is infinite spin', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      // The animate-spin class in Tailwind CSS creates an infinite rotation animation
      expect(spinner).toHaveClass('animate-spin');
    });
  });

  describe('Dark Mode Support', () => {
    it('text has dark mode variant', () => {
      render(<PageLoader />);
      
      const text = screen.getByText('Loading...');
      expect(text).toHaveClass('dark:text-gray-400');
    });

    it('names ONE ring class and lets the token answer for both grounds', () => {
      render(<PageLoader />);

      const spinner = document.querySelector('.animate-spin');
      // No `dark:` variant here, and that is the point of the token rather than
      // an omission: `.dark .border-primary` in index.css supplies #94a3b8, so
      // a second class at this call site would be a colour decision made twice.
      expect(spinner).toHaveClass('border-primary');
      expect(spinner?.className).not.toMatch(/dark:border-/);
    });
  });

  describe('Performance', () => {
    it('renders minimal DOM elements', () => {
      const { container } = render(<PageLoader />);
      
      // Should only have 2 divs, 1 spinner div, and 1 paragraph
      const allElements = container.querySelectorAll('*');
      expect(allElements.length).toBe(4);
    });

    it('uses CSS animations instead of JavaScript', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      // Uses Tailwind's animate-spin which is pure CSS
      expect(spinner).toHaveClass('animate-spin');
    });
  });
});