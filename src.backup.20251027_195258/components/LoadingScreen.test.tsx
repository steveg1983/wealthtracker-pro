/**
 * LoadingScreen Tests
 * Tests for the full-screen loading component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingScreen from './LoadingScreen';

describe('LoadingScreen', () => {
  describe('Basic Rendering', () => {
    it('renders the loading screen', () => {
      render(<LoadingScreen />);
      
      expect(screen.getByText("Danielle's Money")).toBeInTheDocument();
      expect(screen.getByText('Loading your finances...')).toBeInTheDocument();
    });

    it('renders waving hand emoji with animation', () => {
      render(<LoadingScreen />);
      
      const emoji = screen.getByText('👋');
      expect(emoji).toBeInTheDocument();
      expect(emoji).toHaveClass('inline-block', 'animate-bounce');
    });

    it('renders spinner element', () => {
      render(<LoadingScreen />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Layout and Structure', () => {
    it('uses full screen height', () => {
      const { container } = render(<LoadingScreen />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('min-h-screen');
    });

    it('centers content vertically and horizontally', () => {
      const { container } = render(<LoadingScreen />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('centers text content', () => {
      render(<LoadingScreen />);
      
      const textContainer = screen.getByText("Danielle's Money").parentElement;
      expect(textContainer).toHaveClass('text-center');
    });

    it('has correct DOM structure', () => {
      const { container } = render(<LoadingScreen />);
      
      // Check structure: wrapper > text-center > (h1, spinner, p)
      const wrapper = container.firstChild;
      const textCenter = wrapper?.firstChild;
      const children = textCenter?.children;
      
      expect(children).toHaveLength(3);
      expect(children?.[0].tagName).toBe('H1');
      expect(children?.[1]).toHaveClass('animate-spin');
      expect(children?.[2].tagName).toBe('P');
    });
  });

  describe('Styling', () => {
    it('applies correct background colors', () => {
      const { container } = render(<LoadingScreen />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('bg-blue-50', 'dark:bg-gray-900');
    });

    it('applies correct title styling', () => {
      render(<LoadingScreen />);
      
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveClass(
        'text-2xl',
        'font-bold',
        'text-primary',
        'dark:text-pink-400',
        'mb-4'
      );
    });

    it('applies correct loading text styling', () => {
      render(<LoadingScreen />);
      
      const loadingText = screen.getByText('Loading your finances...');
      expect(loadingText).toHaveClass('mt-4', 'text-gray-600', 'dark:text-gray-400');
    });

    it('styles spinner correctly', () => {
      render(<LoadingScreen />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass(
        'animate-spin',
        'rounded-full',
        'h-12',
        'w-12',
        'border-b-2',
        'border-primary',
        'mx-auto'
      );
    });
  });

  describe('Content', () => {
    it('displays app name in title', () => {
      render(<LoadingScreen />);
      
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent("Danielle's Money 👋");
    });

    it('displays loading message', () => {
      render(<LoadingScreen />);
      
      expect(screen.getByText('Loading your finances...')).toBeInTheDocument();
    });

    it('emoji is part of the heading', () => {
      render(<LoadingScreen />);
      
      const heading = screen.getByRole('heading', { level: 1 });
      const emoji = heading.querySelector('.animate-bounce');
      expect(emoji).toHaveTextContent('👋');
    });
  });

  describe('Animations', () => {
    it('spinner has spin animation', () => {
      render(<LoadingScreen />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('emoji has bounce animation', () => {
      render(<LoadingScreen />);
      
      const emoji = screen.getByText('👋');
      expect(emoji).toHaveClass('animate-bounce');
    });

    it('spinner is circular', () => {
      render(<LoadingScreen />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('rounded-full');
    });
  });

  describe('Accessibility', () => {
    it('has semantic heading structure', () => {
      render(<LoadingScreen />);
      
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it('loading text is readable', () => {
      render(<LoadingScreen />);
      
      const loadingText = screen.getByText('Loading your finances...');
      expect(loadingText).toBeInTheDocument();
      expect(loadingText.tagName).toBe('P');
    });

    it('maintains proper contrast in dark mode', () => {
      render(<LoadingScreen />);
      
      const wrapper = screen.getByText("Danielle's Money").closest('.min-h-screen');
      const title = screen.getByRole('heading');
      const text = screen.getByText('Loading your finances...');
      
      expect(wrapper).toHaveClass('dark:bg-gray-900');
      expect(title).toHaveClass('dark:text-pink-400');
      expect(text).toHaveClass('dark:text-gray-400');
    });
  });

  describe('Spinner Styling', () => {
    it('spinner has correct dimensions', () => {
      render(<LoadingScreen />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-12', 'w-12');
    });

    it('spinner has bottom border only', () => {
      render(<LoadingScreen />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-b-2');
    });

    it('spinner uses primary color', () => {
      render(<LoadingScreen />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-primary');
    });

    it('spinner is horizontally centered', () => {
      render(<LoadingScreen />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('mx-auto');
    });
  });

  describe('Performance', () => {
    it('renders minimal DOM elements', () => {
      const { container } = render(<LoadingScreen />);
      
      // Should only have: wrapper, text-center, h1, span (emoji), spinner div, p
      const allElements = container.querySelectorAll('*');
      expect(allElements.length).toBe(6);
    });

    it('uses CSS animations only', () => {
      render(<LoadingScreen />);
      
      // Both animations are CSS-based (Tailwind classes)
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      expect(document.querySelector('.animate-bounce')).toBeInTheDocument();
    });
  });

  describe('Dark Mode Support', () => {
    it('has dark mode background variant', () => {
      const { container } = render(<LoadingScreen />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('dark:bg-gray-900');
    });

    it('has dark mode text color variants', () => {
      render(<LoadingScreen />);
      
      const title = screen.getByRole('heading');
      const text = screen.getByText('Loading your finances...');
      
      expect(title).toHaveClass('dark:text-pink-400');
      expect(text).toHaveClass('dark:text-gray-400');
    });
  });
});
