import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResponsiveTable, useResponsiveTable } from './ResponsiveTable';
import { renderHook, act } from '@testing-library/react';

// Sample data for testing
interface TestData {
  id: number;
  name: string;
  email: string;
  status: string;
  amount: number;
}

const mockData: TestData[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', amount: 100 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive', amount: 200 },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Active', amount: 150 },
];

const mockColumns = [
  { key: 'name', label: 'Name', priority: 1 },
  { key: 'email', label: 'Email', priority: 2 },
  { key: 'status', label: 'Status', priority: 3 },
  { 
    key: 'amount', 
    label: 'Amount', 
    render: (item: TestData) => `$${item.amount}`,
    priority: 4 
  },
];

describe('ResponsiveTable', () => {
  const defaultProps = {
    data: mockData,
    columns: mockColumns,
    getRowKey: (item: TestData) => item.id.toString(),
  };

  describe('Basic rendering', () => {
    it('renders table on desktop', () => {
      render(<ResponsiveTable {...defaultProps} />);
      
      // Check table structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      
      // Check headers
      mockColumns.forEach(column => {
        expect(screen.getByText(column.label)).toBeInTheDocument();
      });
      
      // Check data rows - use getAllByText since both desktop and mobile views are rendered
      mockData.forEach(item => {
        expect(screen.getAllByText(item.name).length).toBeGreaterThan(0);
        expect(screen.getAllByText(item.email).length).toBeGreaterThan(0);
        expect(screen.getAllByText(item.status).length).toBeGreaterThan(0);
      });
    });

    it('renders custom values with render function', () => {
      render(<ResponsiveTable {...defaultProps} />);
      
      mockData.forEach(item => {
        expect(screen.getAllByText(`$${item.amount}`).length).toBeGreaterThan(0);
      });
    });

    it('applies custom className', () => {
      render(<ResponsiveTable {...defaultProps} className="custom-table" />);
      
      const tableContainer = screen.getByRole('table').parentElement;
      expect(tableContainer).toHaveClass('custom-table');
    });
  });

  describe('Empty state', () => {
    it('shows default empty message when no data', () => {
      render(<ResponsiveTable {...defaultProps} data={[]} />);
      
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('shows custom empty message', () => {
      render(
        <ResponsiveTable 
          {...defaultProps} 
          data={[]} 
          emptyMessage="No records found" 
        />
      );
      
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading skeleton when isLoading is true', () => {
      const { container } = render(<ResponsiveTable {...defaultProps} isLoading />);
      
      // Check for skeleton animation
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
      
      // Should not show actual data
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('shows desktop skeleton on larger screens', () => {
      const { container } = render(<ResponsiveTable {...defaultProps} isLoading />);
      
      const desktopSkeleton = container.querySelector('.hidden.sm\\:block');
      expect(desktopSkeleton).toBeInTheDocument();
      expect(desktopSkeleton?.querySelectorAll('.bg-gray-100').length).toBe(5);
    });

    it('shows mobile skeleton on smaller screens', () => {
      const { container } = render(<ResponsiveTable {...defaultProps} isLoading />);
      
      const mobileSkeleton = container.querySelector('.sm\\:hidden');
      expect(mobileSkeleton).toBeInTheDocument();
      expect(mobileSkeleton?.querySelectorAll('.shadow').length).toBe(3);
    });
  });

  describe('Row interactions', () => {
    it('handles row click when onRowClick is provided', () => {
      const onRowClick = vi.fn();
      render(<ResponsiveTable {...defaultProps} onRowClick={onRowClick} />);
      
      // Get the desktop table row
      const desktopTable = screen.getByRole('table');
      const firstRow = desktopTable.querySelector('tbody tr');
      fireEvent.click(firstRow!);
      
      expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('applies hover styles when clickable', () => {
      const onRowClick = vi.fn();
      render(<ResponsiveTable {...defaultProps} onRowClick={onRowClick} />);
      
      const desktopTable = screen.getByRole('table');
      const firstRow = desktopTable.querySelector('tbody tr');
      expect(firstRow).toHaveClass('cursor-pointer');
      expect(firstRow).toHaveClass('hover:bg-gray-50');
    });

    it('does not apply hover styles when not clickable', () => {
      render(<ResponsiveTable {...defaultProps} />);
      
      const desktopTable = screen.getByRole('table');
      const firstRow = desktopTable.querySelector('tbody tr');
      expect(firstRow).not.toHaveClass('cursor-pointer');
      expect(firstRow).not.toHaveClass('hover:bg-gray-50');
    });
  });

  describe('Mobile view', () => {
    it('renders cards on mobile', () => {
      const { container } = render(<ResponsiveTable {...defaultProps} />);
      
      const mobileContainer = container.querySelector('.sm\\:hidden');
      expect(mobileContainer).toBeInTheDocument();
      
      // Should render one card per data item
      const cards = mobileContainer?.querySelectorAll('.bg-white');
      expect(cards?.length).toBe(mockData.length);
    });

    it('applies mobile card className', () => {
      const { container } = render(
        <ResponsiveTable {...defaultProps} mobileCardClassName="custom-mobile" />
      );
      
      const mobileContainer = container.querySelector('.sm\\:hidden');
      expect(mobileContainer).toHaveClass('custom-mobile');
    });

    it('respects column priority on mobile', () => {
      const columnsWithPriority = [
        { key: 'status', label: 'Status', priority: 1 },
        { key: 'name', label: 'Name', priority: 2 },
        { key: 'email', label: 'Email', priority: 3 },
      ];
      
      const { container } = render(
        <ResponsiveTable 
          {...defaultProps} 
          columns={columnsWithPriority}
        />
      );
      
      const firstCard = container.querySelector('.sm\\:hidden .bg-white');
      const spans = firstCard?.querySelectorAll('span:not(.text-xs)');
      
      // First span should be status (priority 1)
      expect(spans?.[0]?.textContent).toBe('Active');
    });

    it('hides columns with hideOnMobile flag', () => {
      const columnsWithHidden = [
        ...mockColumns,
        { key: 'hidden', label: 'Hidden', hideOnMobile: true },
      ];
      
      const dataWithHidden = mockData.map(item => ({ ...item, hidden: 'secret' }));
      
      const { container } = render(
        <ResponsiveTable 
          data={dataWithHidden}
          columns={columnsWithHidden}
          getRowKey={(item) => item.id.toString()}
        />
      );
      
      // Should appear in desktop view
      expect(screen.getByText('Hidden')).toBeInTheDocument();
      const desktopTable = container.querySelector('.hidden.sm\\:block');
      expect(desktopTable?.textContent).toContain('secret');
      
      // Should not appear in mobile cards
      const mobileView = container.querySelector('.sm\\:hidden');
      expect(mobileView?.textContent).not.toContain('secret');
    });

    it('shows mobile labels when provided', () => {
      const columnsWithMobileLabels = [
        { key: 'name', label: 'Full Name', mobileLabel: 'Name', priority: 1 },
        { key: 'email', label: 'Email Address', mobileLabel: 'Email', priority: 2 },
      ];
      
      const { container } = render(
        <ResponsiveTable 
          {...defaultProps} 
          columns={columnsWithMobileLabels}
        />
      );
      
      const mobileContainer = container.querySelector('.sm\\:hidden');
      expect(mobileContainer?.textContent).toContain('Name:');
      expect(mobileContainer?.textContent).toContain('Email:');
    });

    it('handles mobile card click', () => {
      const onRowClick = vi.fn();
      const { container } = render(
        <ResponsiveTable {...defaultProps} onRowClick={onRowClick} />
      );
      
      const firstCard = container.querySelector('.sm\\:hidden .bg-white');
      fireEvent.click(firstCard!);
      
      expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('applies mobile click styles', () => {
      const onRowClick = vi.fn();
      const { container } = render(
        <ResponsiveTable {...defaultProps} onRowClick={onRowClick} />
      );
      
      const firstCard = container.querySelector('.sm\\:hidden .bg-white');
      expect(firstCard).toHaveClass('cursor-pointer');
      expect(firstCard).toHaveClass('active:scale-[0.98]');
    });
  });

  describe('Column styling', () => {
    it('applies column className', () => {
      const columnsWithStyles = [
        { key: 'name', label: 'Name', className: 'font-bold text-blue-600' },
      ];
      
      const { container } = render(
        <ResponsiveTable 
          {...defaultProps} 
          columns={columnsWithStyles}
        />
      );
      
      // Check in desktop view
      const desktopTable = container.querySelector('.hidden.sm\\:block table');
      const nameCell = desktopTable?.querySelector('tbody tr td');
      expect(nameCell).toHaveClass('font-bold', 'text-blue-600');
    });
  });

  describe('Null and undefined handling', () => {
    it('handles null values in data', () => {
      const dataWithNull = [
        { id: 1, name: 'John', email: null, status: 'Active', amount: 100 },
      ];
      
      render(
        <ResponsiveTable 
          data={dataWithNull}
          columns={mockColumns}
          getRowKey={(item) => item.id.toString()}
        />
      );
      
      expect(screen.getAllByText('John').length).toBeGreaterThan(0);
    });

    it('handles undefined values in data', () => {
      const dataWithUndefined = [
        { id: 1, name: 'John', status: 'Active', amount: 100 },
      ];
      
      render(
        <ResponsiveTable 
          data={dataWithUndefined as any}
          columns={mockColumns}
          getRowKey={(item) => item.id.toString()}
        />
      );
      
      expect(screen.getAllByText('John').length).toBeGreaterThan(0);
    });

    it('does not render null values in mobile view', () => {
      const dataWithNull = [
        { id: 1, name: 'John', email: null, status: null, amount: 100 },
      ];
      
      const { container } = render(
        <ResponsiveTable 
          data={dataWithNull}
          columns={mockColumns}
          getRowKey={(item) => item.id.toString()}
        />
      );
      
      const mobileCard = container.querySelector('.sm\\:hidden .bg-white');
      // Should only show name and amount (non-null values)
      expect(mobileCard?.querySelectorAll('div').length).toBe(2);
    });
  });
});

describe('useResponsiveTable', () => {
  it('initializes with empty selection', () => {
    const { result } = renderHook(() => useResponsiveTable());
    
    expect(result.current.selectedRows.size).toBe(0);
  });

  it('toggles row selection', () => {
    const { result } = renderHook(() => useResponsiveTable());
    
    act(() => {
      result.current.toggleRow('row1');
    });
    
    expect(result.current.selectedRows.has('row1')).toBe(true);
    
    act(() => {
      result.current.toggleRow('row1');
    });
    
    expect(result.current.selectedRows.has('row1')).toBe(false);
  });

  it('selects all rows', () => {
    const { result } = renderHook(() => useResponsiveTable());
    const rowKeys = ['row1', 'row2', 'row3'];
    
    act(() => {
      result.current.selectAll(rowKeys);
    });
    
    expect(result.current.selectedRows.size).toBe(3);
    rowKeys.forEach(key => {
      expect(result.current.selectedRows.has(key)).toBe(true);
    });
  });

  it('clears selection', () => {
    const { result } = renderHook(() => useResponsiveTable());
    
    act(() => {
      result.current.selectAll(['row1', 'row2']);
    });
    
    expect(result.current.selectedRows.size).toBe(2);
    
    act(() => {
      result.current.clearSelection();
    });
    
    expect(result.current.selectedRows.size).toBe(0);
  });

  it('maintains selection state across toggles', () => {
    const { result } = renderHook(() => useResponsiveTable());
    
    act(() => {
      result.current.toggleRow('row1');
    });
    
    act(() => {
      result.current.toggleRow('row2');
    });
    
    act(() => {
      result.current.toggleRow('row3');
    });
    
    expect(result.current.selectedRows.size).toBe(3);
    
    act(() => {
      result.current.toggleRow('row2');
    });
    
    expect(result.current.selectedRows.size).toBe(2);
    expect(result.current.selectedRows.has('row1')).toBe(true);
    expect(result.current.selectedRows.has('row2')).toBe(false);
    expect(result.current.selectedRows.has('row3')).toBe(true);
  });
});