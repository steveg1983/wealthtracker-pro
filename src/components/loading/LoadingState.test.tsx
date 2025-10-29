import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoadingState, LoadingOverlay, LoadingDots, LoadingButton } from './LoadingState';

// Mock the RefreshCwIcon
vi.mock('../icons', () => ({
  RefreshCwIcon: ({ size, className }: { size: number; className: string }) => (
    <div data-testid="refresh-icon" data-size={size} className={className}>
      RefreshCwIcon
    </div>
  ),
}));

describe('LoadingState', () => {
  it('renders with default props', () => {
    render(<LoadingState />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-icon')).toHaveAttribute('data-size', '32');
    expect(screen.getByTestId('refresh-icon')).toHaveClass('animate-spin');
  });

  it('renders with custom message', () => {
    render(<LoadingState message="Please wait..." />);
    
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<LoadingState size="small" />);
    expect(screen.getByTestId('refresh-icon')).toHaveAttribute('data-size', '24');
    
    rerender(<LoadingState size="medium" />);
    expect(screen.getByTestId('refresh-icon')).toHaveAttribute('data-size', '32');
    
    rerender(<LoadingState size="large" />);
    expect(screen.getByTestId('refresh-icon')).toHaveAttribute('data-size', '48');
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingState className="custom-class" />);
    const wrapper = container.firstChild as HTMLElement;
    
    expect(wrapper).toHaveClass('custom-class');
  });

  it('applies correct size classes', () => {
    const { container, rerender } = render(<LoadingState size="small" />);
    let wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('h-32');
    
    rerender(<LoadingState size="medium" />);
    wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('h-48');
    
    rerender(<LoadingState size="large" />);
    wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('h-64');
  });
});

describe('LoadingOverlay', () => {
  it('renders nothing when isLoading is false', () => {
    const { container } = render(<LoadingOverlay isLoading={false} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay when isLoading is true', () => {
    render(<LoadingOverlay isLoading={true} />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingOverlay isLoading={true} message="Processing..." />);
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('applies absolute positioning by default', () => {
    render(<LoadingOverlay isLoading={true} />);
    const overlay = screen.getByText('Loading...').closest('.absolute');
    
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass('absolute');
    expect(overlay).not.toHaveClass('fixed');
  });

  it('applies fixed positioning when fullScreen is true', () => {
    render(<LoadingOverlay isLoading={true} fullScreen={true} />);
    const overlay = screen.getByText('Loading...').closest('.fixed');
    
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass('fixed');
    expect(overlay).not.toHaveClass('absolute');
  });

  it('applies backdrop and overlay styles', () => {
    render(<LoadingOverlay isLoading={true} />);
    const overlay = screen.getByText('Loading...').parentElement?.parentElement;
    
    expect(overlay).toHaveClass('backdrop-blur-sm');
    expect(overlay).toHaveClass('z-50');
  });
});

describe('LoadingDots', () => {
  it('renders three animated dots', () => {
    const { container } = render(<LoadingDots />);
    const dots = container.querySelectorAll('.animate-bounce');
    
    expect(dots).toHaveLength(3);
  });

  it('applies staggered animation delays', () => {
    const { container } = render(<LoadingDots />);
    const dots = container.querySelectorAll('.animate-bounce');
    
    expect(dots[0]).toHaveStyle({ animationDelay: '0ms' });
    expect(dots[1]).toHaveStyle({ animationDelay: '150ms' });
    expect(dots[2]).toHaveStyle({ animationDelay: '300ms' });
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingDots className="custom-dots" />);
    const wrapper = container.firstChild;
    
    expect(wrapper).toHaveClass('custom-dots');
  });

  it('maintains inline-flex layout', () => {
    const { container } = render(<LoadingDots />);
    const wrapper = container.firstChild;
    
    expect(wrapper).toHaveClass('inline-flex');
    expect(wrapper).toHaveClass('space-x-1');
  });
});

describe('LoadingButton', () => {
  it('renders children when not loading', () => {
    render(
      <LoadingButton isLoading={false}>
        Click me
      </LoadingButton>
    );
    
    expect(screen.getByText('Click me')).toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeVisible();
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <LoadingButton isLoading={true}>
        Click me
      </LoadingButton>
    );
    
    expect(screen.getByText('Click me')).toHaveClass('invisible');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
  });

  it('shows custom loading text', () => {
    render(
      <LoadingButton isLoading={true} loadingText="Processing...">
        Click me
      </LoadingButton>
    );
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('handles click events when not loading', () => {
    const handleClick = vi.fn();
    render(
      <LoadingButton isLoading={false} onClick={handleClick}>
        Click me
      </LoadingButton>
    );
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('prevents click events when loading', () => {
    const handleClick = vi.fn();
    render(
      <LoadingButton isLoading={true} onClick={handleClick}>
        Click me
      </LoadingButton>
    );
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('is disabled when isLoading is true', () => {
    render(
      <LoadingButton isLoading={true}>
        Click me
      </LoadingButton>
    );
    
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <LoadingButton isLoading={false} disabled={true}>
        Click me
      </LoadingButton>
    );
    
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(
      <LoadingButton isLoading={false} className="btn-primary">
        Click me
      </LoadingButton>
    );
    
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('applies cursor-not-allowed when loading', () => {
    render(
      <LoadingButton isLoading={true}>
        Click me
      </LoadingButton>
    );
    
    expect(screen.getByRole('button')).toHaveClass('cursor-not-allowed');
  });

  it('positions loading content absolutely', () => {
    render(
      <LoadingButton isLoading={true}>
        Click me
      </LoadingButton>
    );
    
    // The loading content is inside a span with absolute positioning
    const loadingSpan = screen.getByText('Loading...').closest('span.absolute');
    expect(loadingSpan).toBeInTheDocument();
    expect(loadingSpan).toHaveClass('absolute');
    expect(loadingSpan).toHaveClass('inset-0');
  });
});