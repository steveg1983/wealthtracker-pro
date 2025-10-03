import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton, SkeletonText, SkeletonCard, SkeletonTableRow, SkeletonList } from './Skeleton';

describe('Skeleton', () => {
  it('renders with default props', () => {
    render(<Skeleton />);
    
    const skeleton = screen.getByRole('status', { name: 'Loading...' });
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveClass('rounded');
  });

  it('renders with custom dimensions', () => {
    render(<Skeleton width="200px" height="50px" />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ width: '200px', height: '50px' });
  });

  it('renders with numeric dimensions', () => {
    render(<Skeleton width={300} height={100} />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ width: '300px', height: '100px' });
  });

  it('renders different variants', () => {
    const { rerender } = render(<Skeleton variant="text" />);
    let skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('rounded');
    
    rerender(<Skeleton variant="circular" />);
    skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('rounded-full');
    
    rerender(<Skeleton variant="rectangular" />);
    skeleton = screen.getByRole('status');
    expect(skeleton).not.toHaveClass('rounded');
    expect(skeleton).not.toHaveClass('rounded-full');
    expect(skeleton).not.toHaveClass('rounded-lg');
    
    rerender(<Skeleton variant="rounded" />);
    skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('rounded-lg');
  });

  it('renders different animations', () => {
    const { rerender } = render(<Skeleton animation="pulse" />);
    let skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('animate-pulse');
    
    rerender(<Skeleton animation="wave" />);
    skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('animate-shimmer');
    
    rerender(<Skeleton animation="none" />);
    skeleton = screen.getByRole('status');
    expect(skeleton).not.toHaveClass('animate-pulse');
    expect(skeleton).not.toHaveClass('animate-shimmer');
  });

  it('applies custom className', () => {
    render(<Skeleton className="custom-skeleton" />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('custom-skeleton');
  });

  it('has correct default height for text variant', () => {
    render(<Skeleton variant="text" />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ height: '1em' });
  });

  it('has correct default dimensions for non-text variants', () => {
    render(<Skeleton variant="circular" />);
    
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveStyle({ width: '100%', height: '100%' });
  });
});

describe('SkeletonText', () => {
  it('renders single line by default', () => {
    render(<SkeletonText />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(1);
  });

  it('renders multiple lines', () => {
    render(<SkeletonText lines={3} />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(3);
  });

  it('makes last line shorter when multiple lines', () => {
    render(<SkeletonText lines={3} />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons[0]).toHaveStyle({ width: '100%' });
    expect(skeletons[1]).toHaveStyle({ width: '100%' });
    expect(skeletons[2]).toHaveStyle({ width: '80%' });
  });

  it('applies different spacing options', () => {
    const { container, rerender } = render(<SkeletonText lines={2} spacing="tight" />);
    let wrapper = container.firstChild;
    expect(wrapper).toHaveClass('space-y-1');
    
    rerender(<SkeletonText lines={2} spacing="normal" />);
    wrapper = container.firstChild;
    expect(wrapper).toHaveClass('space-y-2');
    
    rerender(<SkeletonText lines={2} spacing="loose" />);
    wrapper = container.firstChild;
    expect(wrapper).toHaveClass('space-y-3');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonText className="custom-text" />);
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-text');
  });
});

describe('SkeletonCard', () => {
  it('renders card structure', () => {
    render(<SkeletonCard />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(4); // Header skeletons + text lines
  });

  it('renders header section with circular skeleton', () => {
    render(<SkeletonCard />);
    
    const skeletons = screen.getAllByRole('status');
    const circularSkeleton = skeletons.find(s => s.classList.contains('rounded-full'));
    expect(circularSkeleton).toBeInTheDocument();
    expect(circularSkeleton).toHaveStyle({ width: '40px', height: '40px' });
  });

  it('applies card styling', () => {
    const { container } = render(<SkeletonCard />);
    
    const card = container.firstChild;
    expect(card).toHaveClass('bg-white');
    expect(card).toHaveClass('dark:bg-gray-800');
    expect(card).toHaveClass('rounded-lg');
    expect(card).toHaveClass('shadow');
    expect(card).toHaveClass('p-6');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonCard className="custom-card" />);
    
    const card = container.firstChild;
    expect(card).toHaveClass('custom-card');
  });
});

describe('SkeletonTableRow', () => {
  it('renders default number of columns', () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRow />
        </tbody>
      </table>
    );
    
    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(5);
  });

  it('renders custom number of columns', () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRow columns={8} />
        </tbody>
      </table>
    );
    
    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(8);
  });

  it('renders skeleton in each cell', () => {
    render(
      <table>
        <tbody>
          <SkeletonTableRow columns={3} />
        </tbody>
      </table>
    );
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(3);
  });

  it('applies table row styling', () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRow />
        </tbody>
      </table>
    );
    
    const row = container.querySelector('tr');
    expect(row).toHaveClass('border-b');
    expect(row).toHaveClass('border-gray-200');
    expect(row).toHaveClass('dark:border-gray-700');
  });

  it('applies cell padding', () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRow />
        </tbody>
      </table>
    );
    
    const cells = container.querySelectorAll('td');
    cells.forEach(cell => {
      expect(cell).toHaveClass('py-4');
      expect(cell).toHaveClass('px-4');
    });
  });
});

describe('SkeletonList', () => {
  it('renders default number of items', () => {
    render(<SkeletonList />);
    
    const listItems = screen.getAllByRole('status').filter(s => 
      s.classList.contains('rounded-full')
    );
    expect(listItems).toHaveLength(5);
  });

  it('renders custom number of items', () => {
    render(<SkeletonList items={3} />);
    
    const listItems = screen.getAllByRole('status').filter(s => 
      s.classList.contains('rounded-full')
    );
    expect(listItems).toHaveLength(3);
  });

  it('renders item structure with circular avatar', () => {
    render(<SkeletonList items={1} />);
    
    const circularSkeleton = screen.getAllByRole('status').find(s => 
      s.classList.contains('rounded-full')
    );
    expect(circularSkeleton).toBeInTheDocument();
    expect(circularSkeleton).toHaveStyle({ width: '48px', height: '48px' });
  });

  it('renders item structure with text lines', () => {
    render(<SkeletonList items={1} />);
    
    const textSkeletons = screen.getAllByRole('status').filter(s => 
      s.classList.contains('rounded') && !s.classList.contains('rounded-full')
    );
    expect(textSkeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders item structure with action button skeleton', () => {
    render(<SkeletonList items={1} />);
    
    const rectangularSkeleton = screen.getAllByRole('status').find(s => 
      !s.classList.contains('rounded') && 
      !s.classList.contains('rounded-full') && 
      !s.classList.contains('rounded-lg')
    );
    expect(rectangularSkeleton).toBeInTheDocument();
    expect(rectangularSkeleton).toHaveStyle({ width: '80px', height: '32px' });
  });

  it('applies list spacing', () => {
    const { container } = render(<SkeletonList />);
    
    const list = container.firstChild;
    expect(list).toHaveClass('space-y-4');
  });

  it('applies item styling', () => {
    const { container } = render(<SkeletonList items={1} />);
    
    const item = container.querySelector('.flex.items-center.space-x-4');
    expect(item).toHaveClass('p-4');
    expect(item).toHaveClass('bg-white');
    expect(item).toHaveClass('dark:bg-gray-800');
    expect(item).toHaveClass('rounded-lg');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonList className="custom-list" />);
    
    const list = container.firstChild;
    expect(list).toHaveClass('custom-list');
  });
});