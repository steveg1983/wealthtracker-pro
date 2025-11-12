/**
 * AccessibleTable Component Tests
 * Comprehensive tests for the accessible table component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibleTable } from './AccessibleTable';
import { formatCurrency as formatCurrencyDecimal } from '../../utils/currency-decimal';

// Mock data types for testing
interface TestData {
  id: string;
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
}

const mockData: TestData[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', age: 30, status: 'active' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', age: 25, status: 'inactive' },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com', age: 35, status: 'active' },
];

const mockColumns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
  { key: 'age', label: 'Age', sortable: true },
  {
    key: 'status',
    label: 'Status',
    render: (item: TestData) => (
      <span className={item.status === 'active' ? 'text-green-600' : 'text-gray-400'}>
        {item.status}
      </span>
    ),
  },
];

describe('AccessibleTable', () => {
  describe('basic rendering', () => {
    it('renders table with data', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="User data table"
        />
      );

      // Check table structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'User data table');
      
      // Check headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      
      // Check data
      mockData.forEach(item => {
        expect(screen.getByText(item.name)).toBeInTheDocument();
        expect(screen.getByText(item.email)).toBeInTheDocument();
        expect(screen.getByText(item.age.toString())).toBeInTheDocument();
      });
    });

    it('renders caption for screen readers', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Test table caption"
        />
      );

      const caption = screen.getByText('Test table caption');
      expect(caption).toBeInTheDocument();
      expect(caption).toHaveClass('sr-only');
    });

    it('renders empty state when no data', () => {
      render(
        <AccessibleTable
          data={[]}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Empty table"
        />
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('renders custom empty message', () => {
      render(
        <AccessibleTable
          data={[]}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Empty table"
          emptyMessage="No users found"
        />
      );

      expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Styled table"
          className="custom-table-class"
        />
      );

      const region = screen.getByRole('region');
      expect(region).toHaveClass('custom-table-class');
    });
  });

  describe('column rendering', () => {
    it('renders columns with custom render function', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Table with custom renders"
        />
      );

      // Check custom rendered status
      const activeStatus = screen.getAllByText('active');
      activeStatus.forEach(el => {
        if (el.tagName === 'SPAN') {
          expect(el).toHaveClass('text-green-600');
        }
      });

      const inactiveStatus = screen.getByText('inactive');
      expect(inactiveStatus).toHaveClass('text-gray-400');
    });

    it('applies column className', () => {
      const columnsWithClass = [
        { key: 'name', label: 'Name', className: 'font-bold' },
        { key: 'email', label: 'Email', className: 'text-blue-600' },
      ];

      render(
        <AccessibleTable
          data={mockData}
          columns={columnsWithClass}
          getRowKey={(item) => item.id}
          caption="Styled columns"
        />
      );

      // Check that className is applied to td elements
      // The text is directly in the td, so we need to check the cells
      const rows = screen.getAllByRole('row');
      // Skip header row
      rows.slice(1).forEach(row => {
        const cells = within(row).getAllByRole('cell');
        // First cell (name column) should have the custom class
        expect(cells[0]).toHaveClass('px-4', 'py-2', 'font-bold');
        // Second cell (email column) should have the custom class
        expect(cells[1]).toHaveClass('px-4', 'py-2', 'text-blue-600');
      });
    });

    it('handles missing data gracefully', () => {
      const dataWithMissing = [
        { id: '1', name: 'John', email: '', age: 30, status: 'active' as const },
        { id: '2', name: 'Jane', email: 'jane@example.com', age: null as any, status: 'inactive' as const },
      ];

      render(
        <AccessibleTable
          data={dataWithMissing}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Table with missing data"
        />
      );

      // Should render empty string for missing email
      const johnRow = screen.getByText('John').closest('tr');
      const johnCells = within(johnRow!).getAllByRole('cell');
      // First cell is name, second is email (should be empty), third is age, fourth is status
      expect(johnCells[1]).toHaveTextContent('');

      // Should render empty string for null age
      const janeRow = screen.getByText('Jane').closest('tr');
      const janeCells = within(janeRow!).getAllByRole('cell');
      // Third cell is age (should be empty due to null)
      expect(janeCells[2]).toHaveTextContent('');
    });
  });

  describe('sorting functionality', () => {
    it('renders sortable columns with proper attributes', () => {
      const handleSort = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Sortable table"
          onSort={handleSort}
          sortField="name"
          sortDirection="asc"
        />
      );

      // Check sortable columns have proper ARIA attributes
      const nameHeader = screen.getByRole('columnheader', { name: /Name column, sortable, sorted ascending/ });
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
      expect(nameHeader).toHaveAttribute('tabIndex', '0');
      expect(nameHeader).toHaveClass('cursor-pointer');

      // Check non-sortable columns
      const emailHeader = screen.getByRole('columnheader', { name: /Email column/ });
      expect(emailHeader).toHaveAttribute('aria-sort', 'none');
      expect(emailHeader).toHaveAttribute('tabIndex', '-1');
      expect(emailHeader).not.toHaveClass('cursor-pointer');
    });

    it('displays sort indicators', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Table with sort indicators"
          onSort={vi.fn()}
          sortField="age"
          sortDirection="desc"
        />
      );

      // Find the age column header
      const ageHeader = screen.getByRole('columnheader', { name: /Age column/ });
      const indicator = within(ageHeader).getByText('↓');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveAttribute('aria-hidden', 'true');
    });

    it('handles click on sortable columns', async () => {
      const handleSort = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Click sortable table"
          onSort={handleSort}
        />
      );

      const nameHeader = screen.getByRole('columnheader', { name: /Name column/ });
      await userEvent.click(nameHeader);
      
      expect(handleSort).toHaveBeenCalledWith('name');
    });

    it('handles keyboard navigation for sorting', () => {
      const handleSort = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Keyboard sortable table"
          onSort={handleSort}
        />
      );

      const ageHeader = screen.getByRole('columnheader', { name: /Age column/ });
      
      // Test Enter key
      fireEvent.keyDown(ageHeader, { key: 'Enter' });
      expect(handleSort).toHaveBeenCalledWith('age');
      
      // Test Space key
      fireEvent.keyDown(ageHeader, { key: ' ' });
      expect(handleSort).toHaveBeenCalledTimes(2);
    });

    it('does not sort non-sortable columns', async () => {
      const handleSort = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Mixed sortable table"
          onSort={handleSort}
        />
      );

      const emailHeader = screen.getByRole('columnheader', { name: /Email column/ });
      await userEvent.click(emailHeader);
      
      expect(handleSort).not.toHaveBeenCalled();
    });
  });

  describe('row selection', () => {
    it('renders selection checkboxes when enabled', () => {
      const handleSelectionChange = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Selectable table"
          onSelectionChange={handleSelectionChange}
          selectedRows={new Set()}
        />
      );

      // Check for select all checkbox
      const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
      expect(selectAll).toBeInTheDocument();
      
      // Check for individual row checkboxes
      mockData.forEach((_, index) => {
        const rowCheckbox = screen.getByRole('checkbox', { name: `Select row ${index + 1}` });
        expect(rowCheckbox).toBeInTheDocument();
      });
    });

    it('handles select all functionality', async () => {
      const handleSelectionChange = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Select all table"
          onSelectionChange={handleSelectionChange}
          selectedRows={new Set()}
        />
      );

      const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
      await userEvent.click(selectAll);
      
      expect(handleSelectionChange).toHaveBeenCalledWith(new Set(['1', '2', '3']));
    });

    it('handles deselect all functionality', async () => {
      const handleSelectionChange = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Deselect all table"
          onSelectionChange={handleSelectionChange}
          selectedRows={new Set(['1', '2', '3'])}
        />
      );

      const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
      expect(selectAll).toBeChecked();
      
      await userEvent.click(selectAll);
      
      expect(handleSelectionChange).toHaveBeenCalledWith(new Set());
    });

    it('handles individual row selection', async () => {
      const handleSelectionChange = vi.fn();
      const selectedRows = new Set(['1']);
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Individual selection table"
          onSelectionChange={handleSelectionChange}
          selectedRows={selectedRows}
        />
      );

      const secondRowCheckbox = screen.getByRole('checkbox', { name: 'Select row 2' });
      await userEvent.click(secondRowCheckbox);
      
      expect(handleSelectionChange).toHaveBeenCalledWith(new Set(['1', '2']));
    });

    it('handles row deselection', async () => {
      const handleSelectionChange = vi.fn();
      const selectedRows = new Set(['1', '2']);
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Deselection table"
          onSelectionChange={handleSelectionChange}
          selectedRows={selectedRows}
        />
      );

      const firstRowCheckbox = screen.getByRole('checkbox', { name: 'Select row 1' });
      expect(firstRowCheckbox).toBeChecked();
      
      await userEvent.click(firstRowCheckbox);
      
      expect(handleSelectionChange).toHaveBeenCalledWith(new Set(['2']));
    });

    it('applies selected row styling', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Styled selection table"
          onSelectionChange={vi.fn()}
          selectedRows={new Set(['2'])}
        />
      );

      const rows = screen.getAllByRole('row');
      // Skip header row (index 0)
      expect(rows[2]).toHaveClass('bg-blue-50');
    });

    it('stops propagation on checkbox click', async () => {
      const handleRowClick = vi.fn();
      const handleSelectionChange = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Click propagation table"
          onRowClick={handleRowClick}
          onSelectionChange={handleSelectionChange}
          selectedRows={new Set()}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: 'Select row 1' });
      await userEvent.click(checkbox);
      
      expect(handleSelectionChange).toHaveBeenCalled();
      expect(handleRowClick).not.toHaveBeenCalled();
    });
  });

  describe('row click functionality', () => {
    it('makes rows clickable when onRowClick is provided', () => {
      const handleRowClick = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Clickable rows table"
          onRowClick={handleRowClick}
        />
      );

      const rows = screen.getAllByRole('row');
      // Data rows should have tabIndex 0 (skip header)
      rows.slice(1).forEach(row => {
        expect(row).toHaveAttribute('tabIndex', '0');
        expect(row).toHaveClass('cursor-pointer');
      });
    });

    it('handles row click', async () => {
      const handleRowClick = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Row click table"
          onRowClick={handleRowClick}
        />
      );

      const johnRow = screen.getByText('John Doe').closest('tr');
      await userEvent.click(johnRow!);
      
      expect(handleRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('handles keyboard navigation on rows', () => {
      const handleRowClick = vi.fn();
      
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Keyboard nav table"
          onRowClick={handleRowClick}
        />
      );

      const janeRow = screen.getByText('Jane Smith').closest('tr');
      
      // Test Enter key
      fireEvent.keyDown(janeRow!, { key: 'Enter' });
      expect(handleRowClick).toHaveBeenCalledWith(mockData[1]);
      
      // Test Space key
      fireEvent.keyDown(janeRow!, { key: ' ' });
      expect(handleRowClick).toHaveBeenCalledTimes(2);
    });

    it('does not make rows clickable without onRowClick', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Non-clickable rows table"
        />
      );

      const rows = screen.getAllByRole('row');
      // Data rows should have tabIndex -1 (skip header)
      rows.slice(1).forEach(row => {
        expect(row).toHaveAttribute('tabIndex', '-1');
        expect(row).not.toHaveClass('cursor-pointer');
      });
    });
  });

  describe('accessibility features', () => {
    it('has proper ARIA roles', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="ARIA table"
        />
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(mockData.length + 1); // +1 for header
      expect(screen.getAllByRole('columnheader')).toHaveLength(mockColumns.length);
      expect(screen.getAllByRole('cell')).toHaveLength(mockData.length * mockColumns.length);
    });

    it('provides proper aria-rowindex', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Row index table"
        />
      );

      const rows = screen.getAllByRole('row');
      // Skip header row
      rows.slice(1).forEach((row, index) => {
        expect(row).toHaveAttribute('aria-rowindex', String(index + 2));
      });
    });

    it('provides descriptive aria-labels for sortable columns', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Descriptive labels table"
          onSort={vi.fn()}
          sortField="name"
          sortDirection="asc"
        />
      );

      expect(screen.getByRole('columnheader', { 
        name: 'Name column, sortable, sorted ascending' 
      })).toBeInTheDocument();
      
      expect(screen.getByRole('columnheader', { 
        name: 'Age column, sortable' 
      })).toBeInTheDocument();
      
      expect(screen.getByRole('columnheader', { 
        name: 'Email column' 
      })).toBeInTheDocument();
    });

    it('properly handles scope attributes', () => {
      render(
        <AccessibleTable
          data={mockData}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Scope table"
        />
      );

      const headers = screen.getAllByRole('columnheader');
      headers.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col');
      });
    });
  });

  describe('real-world usage', () => {
    it('works as a user management table', () => {
      const users = [
        { id: '1', name: 'Admin User', role: 'admin', lastLogin: '2024-01-20', active: true },
        { id: '2', name: 'Regular User', role: 'user', lastLogin: '2024-01-19', active: true },
        { id: '3', name: 'Inactive User', role: 'user', lastLogin: '2023-12-01', active: false },
      ];

      const columns = [
        { key: 'name', label: 'Name', sortable: true },
        { 
          key: 'role', 
          label: 'Role',
          render: (user: typeof users[0]) => (
            <span className={`px-2 py-1 rounded text-xs ${
              user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {user.role}
            </span>
          )
        },
        { key: 'lastLogin', label: 'Last Login', sortable: true },
        { 
          key: 'active', 
          label: 'Status',
          render: (user: typeof users[0]) => (
            <span className={user.active ? 'text-green-600' : 'text-red-600'}>
              {user.active ? 'Active' : 'Inactive'}
            </span>
          )
        },
      ];

      const handleSort = vi.fn();
      const handleRowClick = vi.fn();
      const handleSelectionChange = vi.fn();

      render(
        <AccessibleTable
          data={users}
          columns={columns}
          getRowKey={(user) => user.id}
          caption="User management table"
          onSort={handleSort}
          onRowClick={handleRowClick}
          onSelectionChange={handleSelectionChange}
          selectedRows={new Set(['1'])}
          sortField="name"
          sortDirection="asc"
        />
      );

      // Verify all functionality works together
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('admin')).toHaveClass('bg-purple-100');
      expect(screen.getByText('Inactive')).toHaveClass('text-red-600');
      
      // Admin should be selected
      const adminCheckbox = screen.getByRole('checkbox', { name: 'Select row 1' });
      expect(adminCheckbox).toBeChecked();
    });

    it('works as a financial transactions table', () => {
      const transactions = [
        { id: 't1', date: '2024-01-20', description: 'Grocery Store', amount: -125.50, category: 'Food' },
        { id: 't2', date: '2024-01-19', description: 'Salary Deposit', amount: 3000.00, category: 'Income' },
        { id: 't3', date: '2024-01-18', description: 'Electric Bill', amount: -85.00, category: 'Utilities' },
      ];

      const formatUSD = (value: number) => formatCurrencyDecimal(value, 'USD');

      const columns = [
        { key: 'date', label: 'Date', sortable: true },
        { key: 'description', label: 'Description' },
        { 
          key: 'amount', 
          label: 'Amount', 
          sortable: true,
          render: (tx: typeof transactions[0]) => (
            <span className={tx.amount < 0 ? 'text-red-600' : 'text-green-600'}>
              {formatUSD(tx.amount)}
            </span>
          )
        },
        { key: 'category', label: 'Category' },
      ];

      render(
        <AccessibleTable
          data={transactions}
          columns={columns}
          getRowKey={(tx) => tx.id}
          caption="Financial transactions"
          sortField="date"
          sortDirection="desc"
          onSort={vi.fn()}
        />
      );

      // Verify proper rendering
      expect(screen.getByText('-$125.50')).toHaveClass('text-red-600');
      expect(screen.getByText('$3,000.00')).toHaveClass('text-green-600');
      expect(screen.getByRole('columnheader', { name: /Date column, sortable, sorted descending/ })).toBeInTheDocument();
    });

    it('handles empty state gracefully', () => {
      render(
        <AccessibleTable
          data={[]}
          columns={mockColumns}
          getRowKey={(item) => item.id}
          caption="Empty transactions"
          emptyMessage="No transactions found. Add your first transaction to get started."
          onSelectionChange={vi.fn()}
          selectedRows={new Set()}
        />
      );

      expect(screen.getByText('No transactions found. Add your first transaction to get started.')).toBeInTheDocument();
      
      // Select all should be unchecked when no data
      const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
      expect(selectAll).not.toBeChecked();
    });
  });
});
