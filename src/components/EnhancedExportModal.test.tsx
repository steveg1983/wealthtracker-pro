import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EnhancedExportModal from './EnhancedExportModal';
import type { ExportTemplate } from '../services/exportService';

// Mock icons
vi.mock('./icons', () => ({
  XIcon: ({ size: _size }: { size?: number }) => <div data-testid="x-icon">X</div>,
  DownloadIcon: ({ size: _size }: { size?: number }) => <div data-testid="download-icon">Download</div>,
  FileTextIcon: ({ size: _size }: { size?: number }) => <div data-testid="file-text-icon">FileText</div>,
  RefreshCwIcon: ({ size: _size, className }: { size?: number; className?: string }) => (
    <div data-testid="refresh-icon" className={className}>Refresh</div>
  ),
  PlayIcon: ({ size: _size }: { size?: number }) => <div data-testid="play-icon">Play</div>,
}));

// Mock export service
const mockTemplates: ExportTemplate[] = [
  {
    id: 'monthly-report',
    name: 'Monthly Report',
    description: 'Complete monthly financial summary',
    options: {
      format: 'pdf',
      includeCharts: true,
      includeTransactions: true,
      includeAccounts: true,
      includeInvestments: true,
      includeBudgets: true,
      groupBy: 'category'
    }
  },
  {
    id: 'tax-export',
    name: 'Tax Export',
    description: 'Transaction data for tax purposes',
    options: {
      format: 'csv',
      includeCharts: false,
      includeTransactions: true,
      includeAccounts: false,
      includeInvestments: false,
      includeBudgets: false,
      groupBy: 'none'
    }
  }
];

vi.mock('../services/exportService', () => ({
  exportService: {
    getTemplates: vi.fn(() => mockTemplates),
    exportToPDF: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
    exportToCSV: vi.fn(() => Promise.resolve('csv data'))
  }
}));

describe('EnhancedExportModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    // Mock HTMLAnchorElement.click to prevent navigation
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<EnhancedExportModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Export Data')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      expect(screen.getByText('Export Data')).toBeInTheDocument();
    });

    it('renders custom title', () => {
      render(<EnhancedExportModal {...defaultProps} title="Custom Export" />);
      expect(screen.getByText('Custom Export')).toBeInTheDocument();
    });

    it('renders quick templates', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      expect(screen.getByText('Quick Templates')).toBeInTheDocument();
      expect(screen.getByText('Monthly Report')).toBeInTheDocument();
      expect(screen.getByText('Tax Export')).toBeInTheDocument();
    });

    it('renders quick date ranges', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      expect(screen.getByText('Quick Date Ranges')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
      expect(screen.getByText('This Quarter')).toBeInTheDocument();
      expect(screen.getByText('This Year')).toBeInTheDocument();
      expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
      expect(screen.getByText('Last 90 Days')).toBeInTheDocument();
    });

    it('renders custom date range inputs', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      expect(screen.getByText('Custom Date Range')).toBeInTheDocument();
      expect(screen.getByText('Start Date')).toBeInTheDocument();
      expect(screen.getByText('End Date')).toBeInTheDocument();
      
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs).toHaveLength(2);
    });

    it('renders export options', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      expect(screen.getByText('Export Options')).toBeInTheDocument();
      expect(screen.getByText('Format')).toBeInTheDocument();
      expect(screen.getByText('Group By')).toBeInTheDocument();
      
      // Verify select elements exist
      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(2);
    });

    it('renders data inclusion checkboxes', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Investments')).toBeInTheDocument();
      expect(screen.getByText('Budgets')).toBeInTheDocument();
      expect(screen.getByText('Charts')).toBeInTheDocument();
    });
  });

  describe('Default Options', () => {
    it('sets default date range to current month', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      
      expect(dateInputs[0].value).toBe(startOfMonth.toISOString().split('T')[0]);
      expect(dateInputs[1].value).toBe(now.toISOString().split('T')[0]);
    });

    it('uses provided default options', () => {
      const defaultOptions = {
        format: 'csv' as const,
        includeCharts: false,
        includeTransactions: false
      };
      
      render(<EnhancedExportModal {...defaultProps} defaultOptions={defaultOptions} />);
      
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const formatSelect = selects[0];
      expect(formatSelect.value).toBe('csv');
      
      const chartsCheckbox = screen.getByRole('checkbox', { name: /Charts/i }) as HTMLInputElement;
      expect(chartsCheckbox.checked).toBe(false);
      
      const transactionsCheckbox = screen.getByRole('checkbox', { name: /Transactions/i }) as HTMLInputElement;
      expect(transactionsCheckbox.checked).toBe(false);
    });
  });

  describe('Template Selection', () => {
    it('highlights selected template', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const monthlyReportButton = screen.getByText('Monthly Report').closest('button')!;
      fireEvent.click(monthlyReportButton);
      
      expect(monthlyReportButton).toHaveClass('border-[var(--color-primary)]', 'bg-blue-50');
    });

    it('applies template options when selected', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      // Initially CSV format
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const formatSelect = selects[0];
      fireEvent.change(formatSelect, { target: { value: 'csv' } });
      
      // Select monthly report template (PDF format)
      fireEvent.click(screen.getByText('Monthly Report'));
      
      expect(formatSelect.value).toBe('pdf');
    });

    it('preserves date range when applying template', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      // Change date range
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });
      
      // Select template
      fireEvent.click(screen.getByText('Tax Export'));
      
      // Date should remain unchanged
      expect(dateInputs[0].value).toBe('2024-01-01');
    });
  });

  describe('Quick Date Ranges', () => {
    it('sets this month date range', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('This Month'));
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      
      expect(dateInputs[0].value).toBe(startOfMonth.toISOString().split('T')[0]);
      expect(dateInputs[1].value).toBe(now.toISOString().split('T')[0]);
    });

    it('sets last month date range', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Last Month'));
      
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      
      expect(dateInputs[0].value).toBe(startOfLastMonth.toISOString().split('T')[0]);
      expect(dateInputs[1].value).toBe(endOfLastMonth.toISOString().split('T')[0]);
    });

    it('sets last 30 days date range', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Last 30 Days'));
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      
      expect(dateInputs[0].value).toBe(thirtyDaysAgo.toISOString().split('T')[0]);
    });
  });

  describe('Custom Date Range', () => {
    it('updates start date', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      fireEvent.change(dateInputs[0], { target: { value: '2024-01-15' } });
      
      expect(dateInputs[0].value).toBe('2024-01-15');
    });

    it('updates end date', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      fireEvent.change(dateInputs[1], { target: { value: '2024-01-31' } });
      
      expect(dateInputs[1].value).toBe('2024-01-31');
    });
  });

  describe('Export Options', () => {
    it('changes format', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const formatSelect = selects[0];
      fireEvent.change(formatSelect, { target: { value: 'xlsx' } });
      
      expect(formatSelect.value).toBe('xlsx');
    });

    it('changes group by option', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const groupBySelect = selects[1];
      fireEvent.change(groupBySelect, { target: { value: 'account' } });
      
      expect(groupBySelect.value).toBe('account');
    });

    it('toggles data inclusion checkboxes', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const transactionsCheckbox = screen.getByRole('checkbox', { name: /Transactions/i }) as HTMLInputElement;
      
      // Initially checked
      expect(transactionsCheckbox.checked).toBe(true);
      
      fireEvent.click(transactionsCheckbox);
      expect(transactionsCheckbox.checked).toBe(false);
    });

    it('disables charts option for non-PDF formats', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const formatSelect = selects[0];
      const chartsCheckbox = screen.getByRole('checkbox', { name: /Charts/i }) as HTMLInputElement;
      
      // Initially PDF format, charts enabled
      expect(chartsCheckbox.disabled).toBe(false);
      
      // Change to CSV
      fireEvent.change(formatSelect, { target: { value: 'csv' } });
      
      expect(chartsCheckbox.disabled).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    it('exports PDF successfully', async () => {
      const { exportService } = await import('../services/exportService');
      render(<EnhancedExportModal {...defaultProps} />);
      
      // Create a spy for document methods
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');
      
      fireEvent.click(screen.getByText('Export'));
      
      await waitFor(() => {
        expect(exportService.exportToPDF).toHaveBeenCalled();
        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(appendChildSpy).toHaveBeenCalled();
        expect(removeChildSpy).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('exports CSV successfully', async () => {
      const { exportService } = await import('../services/exportService');
      render(<EnhancedExportModal {...defaultProps} />);
      
      // Change to CSV format
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const formatSelect = selects[0];
      fireEvent.change(formatSelect, { target: { value: 'csv' } });
      
      fireEvent.click(screen.getByText('Export'));
      
      await waitFor(() => {
        expect(exportService.exportToCSV).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows loading state during export', async () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Export'));
      
      expect(screen.getByText('Exporting...')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-icon')).toHaveClass('animate-spin');
      
      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });
    });

    it('handles export error', async () => {
      const { exportService } = await import('../services/exportService');
      vi.mocked(exportService.exportToPDF).mockRejectedValueOnce(new Error('Export failed'));
      
      render(<EnhancedExportModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Export'));
      
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Export failed. Please try again.');
        expect(defaultProps.onClose).not.toHaveBeenCalled();
      });
    });

    it('disables export button while loading', async () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const exportButton = screen.getByText('Export').closest('button')!;
      fireEvent.click(exportButton);
      
      expect(exportButton).toBeDisabled();
      
      await waitFor(() => {
        expect(exportButton).not.toBeDisabled();
      });
    });
  });

  describe('User Actions', () => {
    it('calls onClose when X button clicked', () => {
      const onClose = vi.fn();
      render(<EnhancedExportModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('x-icon'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel button clicked', () => {
      const onClose = vi.fn();
      render(<EnhancedExportModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('opens advanced options in new tab', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Advanced Options'));
      
      expect(window.open).toHaveBeenCalledWith('/export-manager', '_blank');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty templates array', async () => {
      const { exportService } = await import('../services/exportService');
      vi.mocked(exportService.getTemplates).mockReturnValueOnce([]);
      
      render(<EnhancedExportModal {...defaultProps} />);
      
      expect(screen.queryByText('Quick Templates')).not.toBeInTheDocument();
    });

    it('handles invalid date inputs gracefully', () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      
      // Try to set an empty value - component should default to today's date
      fireEvent.change(dateInputs[0], { target: { value: '' } });
      
      // Date input should have today's date
      const today = new Date().toISOString().split('T')[0];
      expect(dateInputs[0].value).toBe(today);
    });

    it('generates correct filename with date', async () => {
      render(<EnhancedExportModal {...defaultProps} />);
      
      // Set specific date
      const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      fireEvent.change(dateInputs[0], { target: { value: '2024-01-15' } });
      
      // Mock the anchor element that will be created
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
        style: {}
      };
      
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
          return mockLink as any;
        }
        return originalCreateElement(tagName);
      });
      
      fireEvent.click(screen.getByText('Export'));
      
      await waitFor(() => {
        expect(mockLink.download).toBe('export-2024-01-15.pdf');
      });
    });
  });
});
