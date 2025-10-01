import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  describe('Basic rendering', () => {
    it('renders with title only', () => {
      render(<PageHeader title="Test Title" />);
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('renders title as h1 element', () => {
      render(<PageHeader title="Test Title" />);
      
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Test Title');
    });

    it('renders with children', () => {
      render(
        <PageHeader title="Test Title">
          <p>Additional content</p>
        </PageHeader>
      );
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Additional content')).toBeInTheDocument();
    });
  });

  describe('Structure and layout', () => {
    it('wraps content in container with margin bottom', () => {
      const { container } = render(<PageHeader title="Test" />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('mb-6');
    });

    it('renders header with background and styling', () => {
      const { container } = render(<PageHeader title="Test" />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('dark:bg-gray-700', 'rounded-2xl', 'shadow', 'p-4');
    });

    it('renders children after title', () => {
      const { container } = render(
        <PageHeader title="Test Title">
          <p data-testid="child-content">Child content</p>
        </PageHeader>
      );
      
      const header = container.querySelector('.bg-secondary');
      const title = header?.querySelector('h1');
      const child = header?.querySelector('[data-testid="child-content"]');
      
      expect(title?.nextElementSibling).toBe(child);
    });
  });

  describe('Styling', () => {
    it('applies title styling classes', () => {
      render(<PageHeader title="Test Title" />);
      
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveClass('text-3xl', 'font-bold', 'text-white');
    });

    it('includes dark mode classes', () => {
      const { container } = render(<PageHeader title="Test" />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toHaveClass('dark:bg-gray-700');
    });

    it('applies rounded corners', () => {
      const { container } = render(<PageHeader title="Test" />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toHaveClass('rounded-2xl');
    });

    it('applies shadow', () => {
      const { container } = render(<PageHeader title="Test" />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toHaveClass('shadow');
    });

    it('applies padding', () => {
      const { container } = render(<PageHeader title="Test" />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toHaveClass('p-4');
    });
  });

  describe('Children content', () => {
    it('handles no children gracefully', () => {
      const { container } = render(<PageHeader title="Test Title" />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header?.children.length).toBe(1); // Only the h1
    });

    it('renders multiple children', () => {
      render(
        <PageHeader title="Test Title">
          <p>First paragraph</p>
          <p>Second paragraph</p>
          <button>Action button</button>
        </PageHeader>
      );
      
      expect(screen.getByText('First paragraph')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action button' })).toBeInTheDocument();
    });

    it('renders complex children structures', () => {
      render(
        <PageHeader title="Test Title">
          <div>
            <p>Nested content</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        </PageHeader>
      );
      
      expect(screen.getByText('Nested content')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('renders React fragments as children', () => {
      render(
        <PageHeader title="Test Title">
          <>
            <p>Fragment child 1</p>
            <p>Fragment child 2</p>
          </>
        </PageHeader>
      );
      
      expect(screen.getByText('Fragment child 1')).toBeInTheDocument();
      expect(screen.getByText('Fragment child 2')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('renders with empty title', () => {
      render(<PageHeader title="" />);
      
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('');
    });

    it('renders with very long title', () => {
      const longTitle = 'This is a very long title that might cause layout issues or text wrapping in the header component';
      render(<PageHeader title={longTitle} />);
      
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('renders with special characters in title', () => {
      const specialTitle = 'Test & Title <with> "special" \'characters\'';
      render(<PageHeader title={specialTitle} />);
      
      expect(screen.getByText(specialTitle)).toBeInTheDocument();
    });

    it('maintains structure when children is null', () => {
      const { container } = render(
        <PageHeader title="Test Title">
          {null}
        </PageHeader>
      );
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('maintains structure when children is undefined', () => {
      const { container } = render(
        <PageHeader title="Test Title">
          {undefined}
        </PageHeader>
      );
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });
  });
});