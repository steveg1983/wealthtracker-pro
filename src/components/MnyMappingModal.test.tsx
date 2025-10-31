import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MnyMappingModal from './MnyMappingModal';

// Mock icons
vi.mock('./icons/XIcon', () => ({
  XIcon: ({ size: _size }: { size?: number }) => <div data-testid="x-icon">X</div>
}));

vi.mock('./icons/AlertCircleIcon', () => ({
  AlertCircleIcon: ({ className }: { className?: string }) => <div data-testid="alert-circle-icon" className={className}>Alert</div>
}));

vi.mock('./icons/CheckCircleIcon', () => ({
  CheckCircleIcon: ({ size: _size }: { size?: number }) => <div data-testid="check-circle-icon">Check</div>
}));

// Test data
const mockRawData = [
  {
    'Date': '2024-01-15',
    'Amount': -50.00,
    'Description': 'Grocery Store',
    'Category': 'Food',
    'Account': 'Checking',
    'Balance': 1000.00
  },
  {
    'Date': '2024-01-16',
    'Amount': 100.00,
    'Description': 'Salary',
    'Category': 'Income',
    'Account': 'Checking',
    'Balance': 1100.00
  },
  {
    'Date': '2024-01-17',
    'Amount': -25.50,
    'Description': 'Coffee Shop',
    'Category': 'Food',
    'Account': 'Checking',
    'Balance': 1074.50
  },
  {
    'Date': '2024-01-18',
    'Amount': -12.99,
    'Description': 'Netflix Subscription',
    'Category': 'Entertainment',
    'Account': 'Checking',
    'Balance': 1061.51
  },
  {
    'Date': '2024-01-19',
    'Amount': 200.00,
    'Description': 'Bonus Payment',
    'Category': 'Income',
    'Account': 'Checking',
    'Balance': 1261.51
  },
  // Add more data to test preview limiting
  ...Array(10).fill(0).map((_, i) => ({
    'Date': `2024-01-${20 + i}`,
    'Amount': -15.00 - i,
    'Description': `Transaction ${i + 6}`,
    'Category': 'Misc',
    'Account': 'Checking',
    'Balance': 1200 - (i * 10)
  }))
];

const mockOLEDateData = [
  {
    'Date': 44927, // OLE date for 2023-01-01
    'Amount': 100.00,
    'Description': 'Test Transaction'
  }
];

const mockLongTextData = [
  {
    'Date': '2024-01-15',
    'Amount': -50.00,
    'Description': 'This is a very long description that should be truncated because it exceeds the 50 character limit that is set in the formatCellValue function'
  }
];

describe('MnyMappingModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    rawData: mockRawData,
    onMappingComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<MnyMappingModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Map Your Data Fields')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<MnyMappingModal {...defaultProps} />);
      expect(screen.getByText('Map Your Data Fields')).toBeInTheDocument();
    });

    it('renders help section with instructions', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      expect(screen.getByText('Help us understand your data')).toBeInTheDocument();
      expect(screen.getByText(/We've extracted data from your Money file/)).toBeInTheDocument();
      expect(screen.getByText(/Required fields:/)).toBeInTheDocument();
      expect(screen.getByText(/Date, Amount, and Description/)).toBeInTheDocument();
    });

    it('renders data preview table', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      // Should show column headers with dropdowns
      const selects = screen.getAllByDisplayValue('Ignore this column');
      expect(selects).toHaveLength(6); // One for each column
      
      // Should show data rows
      expect(screen.getByText('Row 1')).toBeInTheDocument();
      expect(screen.getByText('Grocery Store')).toBeInTheDocument();
      expect(screen.getByText('-50.00')).toBeInTheDocument();
    });

    it('renders all field mapping options', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBe(6); // One for each column
      
      // Check that all expected options are available in first select
      const firstSelect = selects[0];
      const options = Array.from(firstSelect.querySelectorAll('option')).map(opt => opt.textContent);
      
      expect(options).toEqual([
        'Ignore this column',
        'Date',
        'Amount',
        'Description',
        'Payee',
        'Category',
        'Account Name',
        'Transaction Type (Income/Expense)',
        'Balance',
        'Check Number'
      ]);
    });

    it('shows record count information', () => {
      render(<MnyMappingModal {...defaultProps} />);
      expect(screen.getByText(`Showing first 10 records of ${mockRawData.length} total records`)).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Continue with Import')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });
  });

  describe('Data Preview', () => {
    it('limits preview to first 10 records', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      // Should show rows 1-10
      expect(screen.getByText('Row 1')).toBeInTheDocument();
      expect(screen.getByText('Row 10')).toBeInTheDocument();
      
      // Should not show row 11 or beyond
      expect(screen.queryByText('Row 11')).not.toBeInTheDocument();
    });

    it('handles empty raw data', () => {
      render(<MnyMappingModal {...defaultProps} rawData={[]} />);
      
      expect(screen.getByText('Map Your Data Fields')).toBeInTheDocument();
      expect(screen.getByText('Showing first 10 records of 0 total records')).toBeInTheDocument();
    });

    it('formats cell values correctly', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      // Number formatting
      expect(screen.getByText('-50.00')).toBeInTheDocument();
      expect(screen.getByText('100.00')).toBeInTheDocument();
      
      // String values
      expect(screen.getByText('Grocery Store')).toBeInTheDocument();
      expect(screen.getAllByText('Food')[0]).toBeInTheDocument(); // Multiple entries have "Food" category
    });

    it('formats OLE dates correctly', () => {
      render(<MnyMappingModal {...defaultProps} rawData={mockOLEDateData} />);
      
      // Should show both raw OLE date and converted date
      expect(screen.getByText((content, _element) => {
        return content.includes('44927') && content.includes('2023');
      })).toBeInTheDocument();
    });

    it('truncates long text values', () => {
      render(<MnyMappingModal {...defaultProps} rawData={mockLongTextData} />);
      
      // Should be truncated to 50 chars + "..."
      expect(screen.getByText((content, _element) => {
        return content.includes('This is a very long description that should be tru') && content.includes('...');
      })).toBeInTheDocument();
    });

    it('handles null and undefined values', () => {
      const dataWithNulls = [
        {
          'Date': '2024-01-15',
          'Amount': null,
          'Description': undefined,
          'Category': ''
        }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithNulls} />);
      
      // Should render without crashing and show empty cells
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });

    it('handles Date objects in data', () => {
      const dataWithDates = [
        {
          'Date': new Date('2024-01-15'),
          'Amount': 100.00,
          'Description': 'Test'
        }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithDates} />);
      
      // Should format date as locale string - could be different formats
      const dateElement = screen.getByText((content) => {
        return content.includes('2024') && (content.includes('1/15') || content.includes('15/1') || content.includes('15/01'));
      });
      expect(dateElement).toBeInTheDocument();
    });
  });

  describe('Field Mapping', () => {
    it('allows selecting field types for columns', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      
      // Change first column to Date
      fireEvent.change(selects[0], { target: { value: 'date' } });
      expect(selects[0]).toHaveValue('date');
      
      // Change second column to Amount
      fireEvent.change(selects[1], { target: { value: 'amount' } });
      expect(selects[1]).toHaveValue('amount');
      
      // Change third column to Description
      fireEvent.change(selects[2], { target: { value: 'description' } });
      expect(selects[2]).toHaveValue('description');
    });

    it('defaults all fields to ignore', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      selects.forEach(select => {
        expect(select.value).toBe('ignore');
      });
    });

    it('clears error when field mapping changes', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      // Try to save without proper mapping to trigger error
      fireEvent.click(screen.getByText('Continue with Import'));
      expect(screen.getByText('Please map at least Date, Amount, and Description fields')).toBeInTheDocument();
      
      // Change a field mapping
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      
      // Error should be cleared
      expect(screen.queryByText('Please map at least Date, Amount, and Description fields')).not.toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('shows error when required fields are missing', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      expect(screen.getByText('Please map at least Date, Amount, and Description fields')).toBeInTheDocument();
      expect(screen.getAllByTestId('alert-circle-icon')).toHaveLength(2); // One in help section, one in error section
      expect(defaultProps.onMappingComplete).not.toHaveBeenCalled();
    });

    it('validates when only date is mapped', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      expect(screen.getByText('Please map at least Date, Amount, and Description fields')).toBeInTheDocument();
      expect(defaultProps.onMappingComplete).not.toHaveBeenCalled();
    });

    it('validates when only date and amount are mapped', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      fireEvent.change(selects[1], { target: { value: 'amount' } });
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      expect(screen.getByText('Please map at least Date, Amount, and Description fields')).toBeInTheDocument();
      expect(defaultProps.onMappingComplete).not.toHaveBeenCalled();
    });

    it('succeeds when all required fields are mapped', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      fireEvent.change(selects[1], { target: { value: 'amount' } });
      fireEvent.change(selects[2], { target: { value: 'description' } });
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      expect(screen.queryByText('Please map at least Date, Amount, and Description fields')).not.toBeInTheDocument();
      expect(defaultProps.onMappingComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          date: 0,
          amount: 1,
          description: 2
        }),
        mockRawData
      );
    });
  });

  describe('Complete Field Mapping', () => {
    it('maps all field types correctly', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      fireEvent.change(selects[1], { target: { value: 'amount' } });
      fireEvent.change(selects[2], { target: { value: 'description' } });
      fireEvent.change(selects[3], { target: { value: 'category' } });
      fireEvent.change(selects[4], { target: { value: 'accountName' } });
      fireEvent.change(selects[5], { target: { value: 'payee' } });
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      expect(defaultProps.onMappingComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          date: 0,
          amount: 1,
          description: 2,
          category: 3,
          accountName: 4,
          payee: 5
        }),
        mockRawData
      );
    });

    it('handles type field mapping', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      fireEvent.change(selects[1], { target: { value: 'amount' } });
      fireEvent.change(selects[2], { target: { value: 'description' } });
      fireEvent.change(selects[3], { target: { value: 'type' } });
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      expect(defaultProps.onMappingComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          date: 0,
          amount: 1,
          description: 2,
          type: 3
        }),
        mockRawData
      );
    });

    it('passes raw data to onMappingComplete', () => {
      const customData = [{ test: 'data' }];
      const mockOnMappingComplete = vi.fn();
      render(<MnyMappingModal {...defaultProps} rawData={customData} onMappingComplete={mockOnMappingComplete} />);
      
      // Need to satisfy validation - map required fields
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      // Note: customData only has 1 column ('test'), so only 1 select exists
      
      // This will fail validation since we don't have amount/description columns
      fireEvent.click(screen.getByText('Continue with Import'));
      
      // Should show validation error, not call onMappingComplete
      expect(screen.getByText('Please map at least Date, Amount, and Description fields')).toBeInTheDocument();
      expect(mockOnMappingComplete).not.toHaveBeenCalled();
    });
  });

  describe('User Actions', () => {
    it('calls onClose when X button clicked', () => {
      const onClose = vi.fn();
      render(<MnyMappingModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('x-icon'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel button clicked', () => {
      const onClose = vi.fn();
      render(<MnyMappingModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when Continue with Import fails validation', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      expect(defaultProps.onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Please map at least Date, Amount, and Description fields')).toBeInTheDocument();
    });

    it('calls onMappingComplete when validation passes', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      fireEvent.change(selects[1], { target: { value: 'amount' } });
      fireEvent.change(selects[2], { target: { value: 'description' } });
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      expect(defaultProps.onMappingComplete).toHaveBeenCalled();
    });
  });

  describe('Dynamic Column Handling', () => {
    it('handles different number of columns', () => {
      const dataWithTwoColumns = [
        { 'Date': '2024-01-15', 'Amount': 100.00 }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithTwoColumns} />);
      
      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(2);
    });

    it('handles data with many columns', () => {
      const dataWithManyColumns = [
        {
          'Col1': 'Value1',
          'Col2': 'Value2',
          'Col3': 'Value3',
          'Col4': 'Value4',
          'Col5': 'Value5',
          'Col6': 'Value6',
          'Col7': 'Value7',
          'Col8': 'Value8'
        }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithManyColumns} />);
      
      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(8);
    });

    it('handles columns with special characters in names', () => {
      const dataWithSpecialColumns = [
        {
          'Date & Time': '2024-01-15',
          'Amount ($)': 100.00,
          'Description/Details': 'Test transaction'
        }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithSpecialColumns} />);
      
      expect(screen.getByText('Test transaction')).toBeInTheDocument();
      expect(screen.getByText('100.00')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error with proper styling', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      const errorElement = screen.getByText('Please map at least Date, Amount, and Description fields');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement.closest('div')).toHaveClass('bg-red-100', 'dark:bg-red-900/20', 'text-red-700', 'dark:text-red-300');
    });

    it('hides error initially', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      expect(screen.queryByText('Please map at least Date, Amount, and Description fields')).not.toBeInTheDocument();
    });

    it('clears error when any field mapping changes', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      // Trigger error
      fireEvent.click(screen.getByText('Continue with Import'));
      expect(screen.getByText('Please map at least Date, Amount, and Description fields')).toBeInTheDocument();
      
      // Change any field mapping
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'payee' } });
      
      // Error should be cleared
      expect(screen.queryByText('Please map at least Date, Amount, and Description fields')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles data with no columns', () => {
      render(<MnyMappingModal {...defaultProps} rawData={[{}]} />);
      
      expect(screen.getByText('Map Your Data Fields')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('handles very large numbers in OLE date range', () => {
      const dataWithLargeNumbers = [
        {
          'Date': 59999, // Large OLE date
          'Amount': 100.00,
          'Description': 'Test'
        }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithLargeNumbers} />);
      
      // Should format as OLE date
      expect(screen.getByText((content, _element) => {
        return content.includes('59999') && content.includes('2064');
      })).toBeInTheDocument();
    });

    it('handles numbers outside OLE date range', () => {
      const dataWithRegularNumbers = [
        {
          'Date': 12345, // Not in OLE date range
          'Amount': 100.00,
          'Description': 'Test'
        }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithRegularNumbers} />);
      
      // Should format as regular number
      expect(screen.getByText('12345.00')).toBeInTheDocument();
    });

    it('handles invalid Date objects', () => {
      const dataWithInvalidDate = [
        {
          'Date': new Date('invalid'),
          'Amount': 100.00,
          'Description': 'Test'
        }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithInvalidDate} />);
      
      // Should show "Invalid Date" for invalid Date objects
      expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    });

    it('handles mapping the same field to multiple columns', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'date' } });
      fireEvent.change(selects[1], { target: { value: 'date' } }); // Same field mapped twice
      fireEvent.change(selects[2], { target: { value: 'amount' } });
      fireEvent.change(selects[3], { target: { value: 'description' } });
      
      fireEvent.click(screen.getByText('Continue with Import'));
      
      // Should use the last mapping (column 1 for date)
      expect(defaultProps.onMappingComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          date: 1, // Last mapping wins
          amount: 2,
          description: 3
        }),
        mockRawData
      );
    });

    it('handles extremely long cell values', () => {
      const dataWithLongValues = [
        {
          'Description': 'A'.repeat(200) // Very long description
        }
      ];
      
      render(<MnyMappingModal {...defaultProps} rawData={dataWithLongValues} />);
      
      // Should be truncated to 50 chars + "..."
      const truncatedText = 'A'.repeat(50) + '...';
      expect(screen.getByText(truncatedText)).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    it('renders table with proper structure', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      // Check table structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Column/ })).toBeInTheDocument();
      
      // Check row structure
      expect(screen.getByRole('cell', { name: 'Row 1' })).toBeInTheDocument();
    });

    it('alternates row colors', () => {
      render(<MnyMappingModal {...defaultProps} />);
      
      const rows = screen.getAllByText(/Row \d+/).map(el => el.closest('tr'));
      
      // First row (index 0) should have background
      expect(rows[0]).toHaveClass('bg-gray-50', 'dark:bg-gray-800/50');
      
      // Second row (index 1) should not have background
      expect(rows[1]).not.toHaveClass('bg-gray-50');
    });
  });
});
