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
        'border-blue-600',
        'mx-auto',
        'mb-4'
      );
    });

    it('has correct spinner dimensions', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-12', 'w-12');
    });

    it('has blue border color', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-blue-600');
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

    it('spinner color remains consistent in dark mode', () => {
      render(<PageLoader />);
      
      const spinner = document.querySelector('.animate-spin');
      // Border color stays blue-600 in both light and dark modes
      expect(spinner).toHaveClass('border-blue-600');
      expect(spinner).not.toHaveClass('dark:border-blue-400');
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