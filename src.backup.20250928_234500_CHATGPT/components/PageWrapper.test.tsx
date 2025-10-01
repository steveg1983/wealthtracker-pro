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

    it('applies default header styles', () => {
      const { container } = render(<PageWrapper {...defaultProps} />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('dark:bg-gray-700', 'rounded-2xl', 'shadow', 'p-4', 'relative');
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

    it('renders header content after title', () => {
      const { container } = render(
        <PageWrapper 
          title="Test Page"
          headerContent={<p data-testid="header-content">Header info</p>}
        >
          <div>Content</div>
        </PageWrapper>
      );
      
      const headerDiv = container.querySelector('.bg-secondary');
      const title = headerDiv?.querySelector('h1');
      const headerContent = headerDiv?.querySelector('[data-testid="header-content"]');
      
      expect(title?.nextElementSibling).toBe(headerContent);
    });
  });

  describe('Right content', () => {
    it('renders right content when provided without reducedHeaderWidth', () => {
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

    it('positions right content absolutely within header when not reduced', () => {
      const { container } = render(
        <PageWrapper 
          title="Test Page"
          rightContent={<button data-testid="right-btn">Action</button>}
        >
          <div>Content</div>
        </PageWrapper>
      );
      
      const rightContentContainer = screen.getByTestId('right-btn').parentElement;
      expect(rightContentContainer).toHaveClass('absolute', 'right-4', 'top-1/2', '-translate-y-1/2', 'z-10');
    });

    it('does not render right content inside header when reducedHeaderWidth is true', () => {
      const { container } = render(
        <PageWrapper 
          title="Test Page"
          rightContent={<button data-testid="right-btn">Action</button>}
          reducedHeaderWidth={true}
        >
          <div>Content</div>
        </PageWrapper>
      );
      
      const headerDiv = container.querySelector('.bg-secondary');
      const rightBtnInHeader = headerDiv?.querySelector('[data-testid="right-btn"]');
      expect(rightBtnInHeader).not.toBeInTheDocument();
    });

    it('renders right content outside header when reducedHeaderWidth is true', () => {
      render(
        <PageWrapper 
          title="Test Page"
          rightContent={<button data-testid="right-btn">Action</button>}
          reducedHeaderWidth={true}
        >
          <div>Content</div>
        </PageWrapper>
      );
      
      const rightBtn = screen.getByTestId('right-btn');
      expect(rightBtn).toBeInTheDocument();
      
      const rightContentContainer = rightBtn.parentElement;
      expect(rightContentContainer).toHaveClass('absolute', 'right-0', 'top-1/2', '-translate-y-1/2');
    });
  });

  describe('Reduced header width', () => {
    it('applies reduced width class when reducedHeaderWidth is true', () => {
      const { container } = render(
        <PageWrapper 
          title="Test Page"
          reducedHeaderWidth={true}
        >
          <div>Content</div>
        </PageWrapper>
      );
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toHaveClass('w-[80%]');
    });

    it('does not apply reduced width class when reducedHeaderWidth is false', () => {
      const { container } = render(
        <PageWrapper 
          title="Test Page"
          reducedHeaderWidth={false}
        >
          <div>Content</div>
        </PageWrapper>
      );
      
      const header = container.querySelector('.bg-secondary');
      expect(header).not.toHaveClass('w-[80%]');
    });

    it('does not apply reduced width class by default', () => {
      const { container } = render(<PageWrapper {...defaultProps} />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).not.toHaveClass('w-[80%]');
    });
  });

  describe('Layout structure', () => {
    it('wraps header in relative positioned container', () => {
      const { container } = render(<PageWrapper {...defaultProps} />);
      
      const headerWrapper = container.querySelector('.relative.mb-6');
      expect(headerWrapper).toBeInTheDocument();
      expect(headerWrapper?.querySelector('.bg-secondary')).toBeInTheDocument();
    });

    it('wraps children in relative positioned container', () => {
      render(
        <PageWrapper title="Test">
          <div data-testid="child">Child content</div>
        </PageWrapper>
      );
      
      // The child should be rendered within a relative container
      const child = screen.getByTestId('child');
      expect(child).toBeInTheDocument();
      
      // Check that the parent of the child has relative class
      const parentContainer = child.parentElement;
      expect(parentContainer).toHaveClass('relative');
    });

    it('maintains header margin bottom', () => {
      const { container } = render(<PageWrapper {...defaultProps} />);
      
      const headerWrapper = container.querySelector('.relative');
      expect(headerWrapper).toHaveClass('mb-6');
    });
  });

  describe('Complex scenarios', () => {
    it('renders all optional props together', () => {
      render(
        <PageWrapper 
          title="Complex Page"
          headerContent={<p data-testid="header">Header content</p>}
          rightContent={<button data-testid="action">Action</button>}
          reducedHeaderWidth={true}
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

    it('handles complex header content', () => {
      render(
        <PageWrapper 
          title="Test"
          headerContent={
            <div>
              <p>Paragraph 1</p>
              <p>Paragraph 2</p>
              <button>Header button</button>
            </div>
          }
        >
          <div>Content</div>
        </PageWrapper>
      );
      
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Header button' })).toBeInTheDocument();
    });
  });

  describe('Styling and dark mode', () => {
    it('includes dark mode classes', () => {
      const { container } = render(<PageWrapper {...defaultProps} />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toHaveClass('dark:bg-gray-700');
    });

    it('applies title styling', () => {
      render(<PageWrapper {...defaultProps} />);
      
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveClass('text-3xl', 'font-bold', 'text-white');
    });

    it('applies shadow to header', () => {
      const { container } = render(<PageWrapper {...defaultProps} />);
      
      const header = container.querySelector('.bg-secondary');
      expect(header).toHaveClass('shadow');
    });
  });
});