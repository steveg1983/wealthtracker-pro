import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageWrapper from './PageWrapper';

describe('PageWrapper', () => {
  const defaultProps = {
    title: 'Test Page',
    children: <div>Page content</div>,
  };

  describe('Basic rendering', () => {
    it('renders with minimal props', () => {
      render(<PageWrapper {...defaultProps} />);

      expect(screen.getByText('Test Page')).toBeInTheDocument();
      expect(screen.getByText('Page content')).toBeInTheDocument();
    });

    it('renders title as h1 element', () => {
      render(<PageWrapper {...defaultProps} />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Test Page');
    });

    it('applies heading styles', () => {
      render(<PageWrapper {...defaultProps} />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('text-2xl', 'font-semibold');
    });

    it('renders children in content area', () => {
      render(
        <PageWrapper title="Test">
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </PageWrapper>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('Header content', () => {
    it('renders header content when provided', () => {
      render(
        <PageWrapper
          title="Test Page"
          headerContent={<p>Additional header info</p>}
        >
          <div>Content</div>
        </PageWrapper>
      );

      expect(screen.getByText('Additional header info')).toBeInTheDocument();
    });
  });

  describe('Right content', () => {
    it('renders right content when provided', () => {
      render(
        <PageWrapper
          title="Test Page"
          rightContent={<button>Action</button>}
        >
          <div>Content</div>
        </PageWrapper>
      );

      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('places right content in flex container', () => {
      render(
        <PageWrapper
          title="Test Page"
          rightContent={<button data-testid="right-btn">Action</button>}
        >
          <div>Content</div>
        </PageWrapper>
      );

      const rightContentContainer = screen.getByTestId('right-btn').parentElement;
      expect(rightContentContainer).toHaveClass('flex', 'items-center');
    });
  });

  describe('Layout structure', () => {
    it('wraps children in relative positioned container', () => {
      render(
        <PageWrapper title="Test">
          <div data-testid="child">Child content</div>
        </PageWrapper>
      );

      const child = screen.getByTestId('child');
      expect(child).toBeInTheDocument();

      const parentContainer = child.parentElement;
      expect(parentContainer).toHaveClass('relative');
    });
  });

  describe('Complex scenarios', () => {
    it('renders all optional props together', () => {
      render(
        <PageWrapper
          title="Complex Page"
          headerContent={<p data-testid="header">Header content</p>}
          rightContent={<button data-testid="action">Action</button>}
        >
          <div data-testid="child">Child content</div>
        </PageWrapper>
      );

      expect(screen.getByText('Complex Page')).toBeInTheDocument();
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('action')).toBeInTheDocument();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('handles React fragments as children', () => {
      render(
        <PageWrapper title="Test">
          <>
            <div>First child</div>
            <div>Second child</div>
          </>
        </PageWrapper>
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });
  });
});
