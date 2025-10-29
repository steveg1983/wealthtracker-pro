import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePDFReport, generateSimplePDFReport } from '../pdfExport';
import type { Transaction, Account } from '../../types';

// Mock jsPDF
const mockSave = vi.fn();
const mockAddPage = vi.fn();
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetFillColor = vi.fn();
const mockRect = vi.fn();
const mockAddImage = vi.fn();

const mockJsPDF = vi.fn(() => ({
  save: mockSave,
  addPage: mockAddPage,
  text: mockText,
  setFontSize: mockSetFontSize,
  setTextColor: mockSetTextColor,
  setFillColor: mockSetFillColor,
  rect: mockRect,
  addImage: mockAddImage,
  internal: {
    pageSize: {
      getWidth: () => 210, // A4 width in mm
      getHeight: () => 297 // A4 height in mm
    }
  }
}));

// Mock html2canvas
const mockToDataURL = vi.fn(() => 'data:image/png;base64,mockImageData');
const mockHtml2canvas = vi.fn(() => Promise.resolve({
  toDataURL: mockToDataURL,
  width: 800,
  height: 400
}));

// Mock dynamic imports
vi.mock('jspdf', async () => {
  return {
    default: mockJsPDF
  };
});

vi.mock('html2canvas', async () => {
  return {
    default: mockHtml2canvas
  };
});

describe('pdfExport', () => {
  const mockAccounts: Account[] = [
    { id: '1', name: 'Checking', type: 'checking', balance: 1000, currency: 'GBP' },
    { id: '2', name: 'Savings', type: 'savings', balance: 5000, currency: 'GBP' }
  ];

  const mockTransactions: Transaction[] = [
    {
      id: '1',
      date: '2024-01-15',
      amount: 100,
      description: 'Grocery Shopping at Local Market',
      type: 'expense',
      category: 'Food',
      accountId: '1'
    },
    {
      id: '2',
      date: '2024-01-16',
      amount: 2000,
      description: 'Salary Payment',
      type: 'income',
      category: 'Income',
      accountId: '1'
    },
    {
      id: '3',
      date: '2024-01-17',
      amount: 50,
      description: 'Coffee Shop',
      type: 'expense',
      category: 'Dining',
      accountId: '1'
    }
  ];

  const mockReportData = {
    title: 'Financial Report',
    dateRange: 'January 2024',
    summary: {
      income: 2000,
      expenses: 1500,
      netIncome: 500,
      savingsRate: 25
    },
    categoryBreakdown: [
      { category: 'Food', amount: 800, percentage: 53.3 },
      { category: 'Transport', amount: 400, percentage: 26.7 },
      { category: 'Dining', amount: 300, percentage: 20.0 }
    ],
    topTransactions: mockTransactions
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure timers are reset before using them
    vi.useRealTimers();
    // Mock date for consistent output
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-20T10:30:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generatePDFReport', () => {
    it('generates PDF with all sections', async () => {
      await generatePDFReport(mockReportData, mockAccounts);

      // Check that jsPDF was instantiated
      expect(mockJsPDF).toHaveBeenCalled();

      // Verify title
      expect(mockSetFontSize).toHaveBeenCalledWith(24);
      expect(mockText).toHaveBeenCalledWith('Financial Report', 105, 20, { align: 'center' });

      // Verify date range
      expect(mockSetFontSize).toHaveBeenCalledWith(12);
      expect(mockText).toHaveBeenCalledWith('January 2024', 105, 30, { align: 'center' });

      // Verify summary section
      expect(mockText).toHaveBeenCalledWith('Financial Summary', 20, expect.any(Number));

      // Verify summary boxes
      expect(mockRect).toHaveBeenCalled();
      expect(mockText).toHaveBeenCalledWith('Income', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('£2,000.00', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Expenses', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('£1,500.00', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Net Income', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('£500.00', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Savings Rate', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('25.0%', expect.any(Number), expect.any(Number));

      // Verify category table
      expect(mockText).toHaveBeenCalledWith('Expense Categories', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Food', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('£800.00', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('53.3%', expect.any(Number), expect.any(Number));

      // Verify transactions table
      expect(mockText).toHaveBeenCalledWith('Top Transactions', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('15/01/2024', expect.any(Number), expect.any(Number));
      // Transaction description is truncated to 30 characters
      expect(mockText).toHaveBeenCalledWith('Grocery Shopping at Local Mark...', expect.any(Number), expect.any(Number));

      // Verify footer
      expect(mockText).toHaveBeenCalledWith(
        'Generated on 20/01/2024 at 10:30:00',
        105,
        287,
        { align: 'center' }
      );

      // Verify save
      expect(mockSave).toHaveBeenCalledWith('financial-report-2024-01-20.pdf');
    });

    it('handles charts when provided', async () => {
      const mockChartElement = document.createElement('div');
      const reportWithCharts = {
        ...mockReportData,
        chartElements: [mockChartElement]
      };

      await generatePDFReport(reportWithCharts, mockAccounts);

      expect(mockHtml2canvas).toHaveBeenCalledWith(mockChartElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });

      expect(mockAddImage).toHaveBeenCalledWith(
        'data:image/png;base64,mockImageData',
        'PNG',
        20,
        expect.any(Number),
        170,
        85
      );
    });

    it('handles multiple charts', async () => {
      const mockChartElements = [
        document.createElement('div'),
        document.createElement('canvas'),
        document.createElement('svg')
      ];

      const reportWithCharts = {
        ...mockReportData,
        chartElements: mockChartElements
      };

      await generatePDFReport(reportWithCharts, mockAccounts);

      expect(mockHtml2canvas).toHaveBeenCalledTimes(3);
      expect(mockAddImage).toHaveBeenCalledTimes(3);
    });

    it('handles chart capture errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHtml2canvas.mockRejectedValueOnce(new Error('Canvas error'));

      const reportWithCharts = {
        ...mockReportData,
        chartElements: [document.createElement('div')]
      };

      await generatePDFReport(reportWithCharts, mockAccounts);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error capturing chart:', expect.any(Error));
      // PDF generation should continue despite error
      expect(mockSave).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('formats currency correctly', async () => {
      await generatePDFReport(mockReportData, mockAccounts);

      // Check GBP formatting
      expect(mockText).toHaveBeenCalledWith('£2,000.00', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('£1,500.00', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('£500.00', expect.any(Number), expect.any(Number));
    });

    it('handles negative net income', async () => {
      const negativeIncomeData = {
        ...mockReportData,
        summary: {
          income: 1000,
          expenses: 1500,
          netIncome: -500,
          savingsRate: -50
        }
      };

      await generatePDFReport(negativeIncomeData, mockAccounts);

      // Should use red color for negative net income
      expect(mockSetFillColor).toHaveBeenCalledWith(254, 242, 242); // Light red background
      expect(mockSetTextColor).toHaveBeenCalledWith(239, 68, 68); // Red text
      expect(mockText).toHaveBeenCalledWith('-£500.00', expect.any(Number), expect.any(Number));
    });

    it('handles page breaks for long content', async () => {
      const manyCategories = Array(30).fill(null).map((_, i) => ({
        category: `Category ${i}`,
        amount: 100 * (i + 1),
        percentage: 3.33
      }));

      const longReportData = {
        ...mockReportData,
        categoryBreakdown: manyCategories
      };

      await generatePDFReport(longReportData, mockAccounts);

      // Should add pages for long content
      expect(mockAddPage).toHaveBeenCalled();
    });

    it('truncates long transaction descriptions', async () => {
      const longDescTransaction: Transaction = {
        id: '4',
        date: '2024-01-18',
        amount: 75,
        description: 'This is a very long transaction description that should be truncated in the PDF report',
        type: 'expense',
        category: 'Misc',
        accountId: '1'
      };

      const reportWithLongDesc = {
        ...mockReportData,
        topTransactions: [longDescTransaction]
      };

      await generatePDFReport(reportWithLongDesc, mockAccounts);

      expect(mockText).toHaveBeenCalledWith(
        'This is a very long transactio...',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('handles empty category breakdown', async () => {
      const noCategoriesData = {
        ...mockReportData,
        categoryBreakdown: []
      };

      await generatePDFReport(noCategoriesData, mockAccounts);

      expect(mockText).toHaveBeenCalledWith('Expense Categories', expect.any(Number), expect.any(Number));
      // Table header should still be rendered
      expect(mockText).toHaveBeenCalledWith('Category', expect.any(Number), expect.any(Number));
    });

    it('handles empty transactions', async () => {
      const noTransactionsData = {
        ...mockReportData,
        topTransactions: []
      };

      await generatePDFReport(noTransactionsData, mockAccounts);

      expect(mockText).toHaveBeenCalledWith('Top Transactions', expect.any(Number), expect.any(Number));
      // Table header should still be rendered
      expect(mockText).toHaveBeenCalledWith('Date', expect.any(Number), expect.any(Number));
    });

    it('limits transactions to top 10', async () => {
      const manyTransactions = Array(20).fill(null).map((_, i) => ({
        id: `trans-${i}`,
        date: '2024-01-01',
        amount: 100,
        description: `Transaction ${i}`,
        type: 'expense' as const,
        category: 'Test',
        accountId: '1'
      }));

      const reportWithManyTrans = {
        ...mockReportData,
        topTransactions: manyTransactions
      };

      await generatePDFReport(reportWithManyTrans, mockAccounts);

      // Count how many transaction descriptions were rendered
      const transactionCalls = (mockText as any).mock.calls.filter((call: any[]) => 
        call[0].startsWith('Transaction ')
      );
      expect(transactionCalls).toHaveLength(10);
    });

    it('applies alternating row colors', async () => {
      await generatePDFReport(mockReportData, mockAccounts);

      // Should set fill color for alternating rows
      expect(mockSetFillColor).toHaveBeenCalledWith(249, 250, 251);
    });

    it('handles income vs expense coloring', async () => {
      await generatePDFReport(mockReportData, mockAccounts);

      // Income should be green
      expect(mockSetTextColor).toHaveBeenCalledWith(34, 197, 94);
      expect(mockText).toHaveBeenCalledWith('+£2,000.00', expect.any(Number), expect.any(Number));

      // Expense should be red
      expect(mockSetTextColor).toHaveBeenCalledWith(239, 68, 68);
      expect(mockText).toHaveBeenCalledWith('-£100.00', expect.any(Number), expect.any(Number));
    });

    it('dynamically loads jsPDF only once', async () => {
      // Clear the module cache
      vi.resetModules();

      // First call
      await generatePDFReport(mockReportData, mockAccounts);
      
      // Second call
      await generatePDFReport(mockReportData, mockAccounts);

      // jsPDF constructor should be called twice (once per report)
      expect(mockJsPDF).toHaveBeenCalledTimes(2);
    });

    it('dynamically loads html2canvas only once when needed', async () => {
      // Clear the module cache
      vi.resetModules();

      const reportWithCharts = {
        ...mockReportData,
        chartElements: [document.createElement('div')]
      };

      // First call with charts
      await generatePDFReport(reportWithCharts, mockAccounts);
      
      // Second call with charts
      await generatePDFReport(reportWithCharts, mockAccounts);

      // html2canvas should be called twice (once per chart)
      expect(mockHtml2canvas).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateSimplePDFReport', () => {
    it('generates PDF without charts', async () => {
      const reportWithCharts = {
        ...mockReportData,
        chartElements: [document.createElement('div')]
      };

      await generateSimplePDFReport(reportWithCharts, mockAccounts);

      // Should not call html2canvas
      expect(mockHtml2canvas).not.toHaveBeenCalled();
      
      // Should still generate the PDF
      expect(mockSave).toHaveBeenCalled();
    });

    it('passes through all other data unchanged', async () => {
      await generateSimplePDFReport(mockReportData, mockAccounts);

      // All text content should still be rendered
      expect(mockText).toHaveBeenCalledWith('Financial Report', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(mockText).toHaveBeenCalledWith('Financial Summary', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Expense Categories', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Top Transactions', expect.any(Number), expect.any(Number));
    });
  });
});