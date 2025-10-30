import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Calendar,
  FileSpreadsheet,
  FilePlus,
  X,
  TrendingUp,
  DollarSign,
  PieChart,
  Receipt
} from 'lucide-react';
import { useApp } from '../contexts/AppContextSupabase';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';

// Dynamic imports for heavy libraries (loaded on demand)
let jsPDF: typeof import('jspdf').jsPDF | null = null;
let autoTable: typeof import('jspdf-autotable').default | null = null;
let XLSX: typeof import('xlsx') | null = null;

type ExportFormat = 'pdf' | 'excel' | 'csv';
type ReportType = 'transactions' | 'summary' | 'budget' | 'tax' | 'investment' | 'networth' | 'custom';

interface ExportOptions {
  format: ExportFormat;
  reportType: ReportType;
  dateRange: 'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'custom';
  startDate?: string;
  endDate?: string;
  accounts: string[];
  categories: string[];
  includeCharts: boolean;
  includeNotes: boolean;
  groupBy: 'none' | 'account' | 'category' | 'month';
  customTitle?: string;
  paperSize: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
}

const DATE_RANGE_OPTIONS: ExportOptions['dateRange'][] = [
  'thisMonth',
  'lastMonth',
  'thisYear',
  'lastYear',
  'all',
  'custom'
];

const PAPER_SIZE_OPTIONS: ExportOptions['paperSize'][] = ['a4', 'letter', 'legal'];
const PAPER_SIZE_LABELS: Record<ExportOptions['paperSize'], string> = {
  a4: 'A4',
  letter: 'Letter',
  legal: 'Legal'
};

const ORIENTATION_OPTIONS: ExportOptions['orientation'][] = ['portrait', 'landscape'];
const ORIENTATION_LABELS: Record<ExportOptions['orientation'], string> = {
  portrait: 'Portrait',
  landscape: 'Landscape'
};

const REPORT_TEMPLATES = [
  {
    id: 'monthly-statement',
    name: 'Monthly Statement',
    icon: Calendar,
    description: 'Professional bank-style monthly statement',
    reportType: 'transactions' as ReportType,
    defaults: {
      dateRange: 'lastMonth' as const,
      groupBy: 'account' as const,
      includeCharts: true
    }
  },
  {
    id: 'tax-summary',
    name: 'Tax Summary',
    icon: Receipt,
    description: 'Annual tax-deductible expenses report',
    reportType: 'tax' as ReportType,
    defaults: {
      dateRange: 'lastYear' as const,
      groupBy: 'category' as const,
      includeCharts: false
    }
  },
  {
    id: 'investment-performance',
    name: 'Investment Performance',
    icon: TrendingUp,
    description: 'Portfolio performance and holdings report',
    reportType: 'investment' as ReportType,
    defaults: {
      dateRange: 'thisYear' as const,
      includeCharts: true
    }
  },
  {
    id: 'budget-analysis',
    name: 'Budget Analysis',
    icon: PieChart,
    description: 'Budget vs actual spending analysis',
    reportType: 'budget' as ReportType,
    defaults: {
      dateRange: 'thisMonth' as const,
      groupBy: 'category' as const,
      includeCharts: true
    }
  },
  {
    id: 'net-worth',
    name: 'Net Worth Statement',
    icon: DollarSign,
    description: 'Complete assets and liabilities statement',
    reportType: 'networth' as ReportType,
    defaults: {
      dateRange: 'all' as const,
      includeCharts: true
    }
  }
];

export default function EnhancedExportManager(): React.JSX.Element {
  const { accounts, transactions, budgets, goals } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    reportType: 'transactions',
    dateRange: 'thisMonth',
    accounts: accounts.map(a => a.id),
    categories: [],
    includeCharts: true,
    includeNotes: false,
    groupBy: 'none',
    paperSize: 'a4',
    orientation: 'portrait'
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = REPORT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setOptions(prev => ({
        ...prev,
        reportType: template.reportType,
        ...template.defaults
      }));
    }
  };

  const getDateRange = () => {
    const now = new Date();
    switch (options.dateRange) {
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'thisYear':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'lastYear':
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
      case 'custom':
        return {
          start: options.startDate ? new Date(options.startDate) : now,
          end: options.endDate ? new Date(options.endDate) : now
        };
      default:
        return { start: new Date(2000, 0, 1), end: now };
    }
  };

  const generatePDF = async () => {
    // Load jsPDF dynamically if not already loaded
    if (!jsPDF) {
      const jsPDFModule = await import('jspdf');
      jsPDF = jsPDFModule.jsPDF;
    }
    if (!autoTable) {
      const autoTableModule = await import('jspdf-autotable');
      autoTable = autoTableModule.default;
    }

    const pdf = new jsPDF({
      orientation: options.orientation,
      unit: 'mm',
      format: options.paperSize
    });

    // Add header
    pdf.setFontSize(20);
    pdf.text(options.customTitle || getReportTitle(), 20, 20);
    
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    const dateRange = getDateRange();
    pdf.text(
      `Period: ${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`,
      20,
      30
    );

    // Filter transactions based on options
    const filteredTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= dateRange.start && 
             transactionDate <= dateRange.end &&
             (options.accounts.length === 0 || options.accounts.includes(t.accountId)) &&
             (options.categories.length === 0 || options.categories.includes(t.category));
    });

    // Add summary section
    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text('Summary', 20, 45);
    
    const income = filteredTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = Math.abs(filteredTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));
    
    pdf.setFontSize(10);
    pdf.text(`Total Income: £${income.toFixed(2)}`, 20, 55);
    pdf.text(`Total Expenses: £${expenses.toFixed(2)}`, 20, 62);
    pdf.text(`Net: £${(income - expenses).toFixed(2)}`, 20, 69);
    pdf.text(`Transactions: ${filteredTransactions.length}`, 20, 76);

    // Add transactions table
    if (options.reportType === 'transactions' || options.reportType === 'custom') {
      const tableData = filteredTransactions.map(t => [
        format(new Date(t.date), 'MMM d, yyyy'),
        t.description,
        t.category,
        accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
        `£${Math.abs(t.amount).toFixed(2)}`,
        t.amount > 0 ? 'Income' : 'Expense'
      ]);

      autoTable(pdf, {
        head: [['Date', 'Description', 'Category', 'Account', 'Amount', 'Type']],
        body: tableData,
        startY: 85,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });
    }

    // Add budget comparison if budget report
    if (options.reportType === 'budget' && budgets.length > 0) {
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('Budget Analysis', 20, 20);

      const budgetData = budgets.map(b => {
        const spent = Math.abs(filteredTransactions
          .filter(t => t.category === b.categoryId && t.amount < 0)
          .reduce((sum, t) => sum + t.amount, 0));

        const percentage = (spent / b.amount) * 100;
        
        return [
          b.categoryId,
          `£${b.amount.toFixed(2)}`,
          `£${spent.toFixed(2)}`,
          `£${(b.amount - spent).toFixed(2)}`,
          `${percentage.toFixed(1)}%`
        ];
      });

      autoTable(pdf, {
        head: [['Category', 'Budgeted', 'Spent', 'Remaining', '% Used']],
        body: budgetData,
        startY: 30,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [41, 128, 185] }
      });
    }

    // Add footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `Page ${i} of ${pageCount} | Generated by WealthTracker on ${format(new Date(), 'MMM d, yyyy')}`,
        pdf.internal.pageSize.width / 2,
        pdf.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    return pdf;
  };

  const generateExcel = async () => {
    // Load XLSX dynamically if not already loaded
    if (!XLSX) {
      XLSX = await import('xlsx');
    }

    const workbook = XLSX.utils.book_new();
    const dateRange = getDateRange();

    // Filter transactions
    const filteredTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= dateRange.start && 
             transactionDate <= dateRange.end &&
             (options.accounts.length === 0 || options.accounts.includes(t.accountId)) &&
             (options.categories.length === 0 || options.categories.includes(t.category));
    });

    // Summary Sheet
    const summaryData = [
      ['WealthTracker Export Report'],
      [''],
      ['Report Type:', getReportTitle()],
      ['Date Range:', `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`],
      ['Generated:', format(new Date(), 'MMM d, yyyy HH:mm')],
      [''],
      ['Summary Statistics'],
      ['Total Income:', filteredTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)],
      ['Total Expenses:', Math.abs(filteredTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))],
      ['Net Amount:', filteredTransactions.reduce((sum, t) => sum + t.amount, 0)],
      ['Transaction Count:', filteredTransactions.length]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Transactions Sheet
    if (filteredTransactions.length > 0) {
      const transactionData = [
        ['Date', 'Description', 'Category', 'Account', 'Amount', 'Type', 'Balance'],
        ...filteredTransactions.map(t => [
          format(new Date(t.date), 'yyyy-MM-dd'),
          t.description,
          t.category,
          accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
          t.amount,
          t.amount > 0 ? 'Income' : 'Expense',
          0 // Would calculate running balance in production
        ])
      ];

      const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
      
      // Apply formatting
      const range = XLSX.utils.decode_range(transactionSheet['!ref'] || 'A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!transactionSheet[address]) continue;
        transactionSheet[address].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "2980B9" } },
          alignment: { horizontal: "center" }
        };
      }

      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');
    }

    // Budget Sheet (if applicable)
    if (options.reportType === 'budget' && budgets.length > 0) {
      const budgetData = [
        ['Category', 'Budgeted', 'Spent', 'Remaining', '% Used', 'Status'],
        ...budgets.map(b => {
          const spent = Math.abs(filteredTransactions
            .filter(t => t.category === b.categoryId && parseFloat(t.amount) < 0)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0));
          
          const remaining = parseFloat(b.amount) - spent;
          const percentage = (spent / parseFloat(b.amount)) * 100;
          
          return [
            b.categoryId,
            parseFloat(b.amount),
            spent,
            remaining,
            percentage,
            percentage > 100 ? 'Over Budget' : percentage > 80 ? 'Warning' : 'On Track'
          ];
        })
      ];

      const budgetSheet = XLSX.utils.aoa_to_sheet(budgetData);
      XLSX.utils.book_append_sheet(workbook, budgetSheet, 'Budget Analysis');
    }

    // Category Summary Sheet
    const categoryGroups = new Map<string, number>();
    filteredTransactions.forEach(t => {
      const current = categoryGroups.get(t.category) || 0;
      categoryGroups.set(t.category, current + parseFloat(t.amount));
    });

    const categoryData = [
      ['Category', 'Total Amount', 'Transaction Count', 'Average'],
      ...Array.from(categoryGroups.entries()).map(([category, total]) => {
        const count = filteredTransactions.filter(t => t.category === category).length;
        return [category, total, count, total / count];
      })
    ];

    const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(workbook, categorySheet, 'Category Summary');

    return workbook;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (options.format === 'pdf') {
        const pdf = await generatePDF();
        pdf.save(`${getFileName()}.pdf`);
      } else if (options.format === 'excel') {
        const workbook = await generateExcel();
        XLSX.writeFile(workbook, `${getFileName()}.xlsx`);
      } else if (options.format === 'csv') {
        // Simple CSV export
        const csv = generateCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${getFileName()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const generateCSV = () => {
    const dateRange = getDateRange();
    const filteredTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= dateRange.start && 
             transactionDate <= dateRange.end &&
             (options.accounts.length === 0 || options.accounts.includes(t.accountId)) &&
             (options.categories.length === 0 || options.categories.includes(t.category));
    });

    const headers = ['Date', 'Description', 'Category', 'Account', 'Amount', 'Type'];
    const rows = filteredTransactions.map(t => [
      format(new Date(t.date), 'yyyy-MM-dd'),
      `"${t.description.replace(/"/g, '""')}"`,
      t.category,
      accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
      t.amount,
      parseFloat(t.amount) > 0 ? 'Income' : 'Expense'
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  const getReportTitle = () => {
    switch (options.reportType) {
      case 'transactions': return 'Transaction Report';
      case 'summary': return 'Financial Summary';
      case 'budget': return 'Budget Analysis Report';
      case 'tax': return 'Tax Summary Report';
      case 'investment': return 'Investment Performance Report';
      case 'networth': return 'Net Worth Statement';
      default: return 'Financial Report';
    }
  };

  const getFileName = () => {
    const date = format(new Date(), 'yyyy-MM-dd');
    const type = options.reportType;
    return `wealthtracker-${type}-${date}`;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <Download size={20} />
        Advanced Export
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Export Manager
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              {/* Quick Templates */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Quick Templates
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {REPORT_TEMPLATES.map(template => {
                    const Icon = template.icon;
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateSelect(template.id)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedTemplate === template.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <Icon size={20} className="text-gray-600 dark:text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                              {template.name}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Export Format */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Export Format
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setOptions(prev => ({ ...prev, format: 'pdf' }))}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      options.format === 'pdf'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <FileText size={24} className="mx-auto mb-2 text-red-500" />
                    <p className="text-sm font-medium">PDF</p>
                    <p className="text-xs text-gray-500 mt-1">Professional reports</p>
                  </button>
                  
                  <button
                    onClick={() => setOptions(prev => ({ ...prev, format: 'excel' }))}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      options.format === 'excel'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <FileSpreadsheet size={24} className="mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium">Excel</p>
                    <p className="text-xs text-gray-500 mt-1">Advanced analysis</p>
                  </button>
                  
                  <button
                    onClick={() => setOptions(prev => ({ ...prev, format: 'csv' }))}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      options.format === 'csv'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <FilePlus size={24} className="mx-auto mb-2 text-blue-500" />
                    <p className="text-sm font-medium">CSV</p>
                    <p className="text-xs text-gray-500 mt-1">Universal format</p>
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Date Range
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {DATE_RANGE_OPTIONS.map(range => (
                    <button
                      key={range}
                      onClick={() => setOptions(prev => ({ ...prev, dateRange: range }))}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        options.dateRange === range
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {range === 'thisMonth' && 'This Month'}
                      {range === 'lastMonth' && 'Last Month'}
                      {range === 'thisYear' && 'This Year'}
                      {range === 'lastYear' && 'Last Year'}
                      {range === 'all' && 'All Time'}
                      {range === 'custom' && 'Custom'}
                    </button>
                  ))}
                </div>

                {options.dateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <input
                      type="date"
                      value={options.startDate}
                      onChange={(e) => setOptions(prev => ({ ...prev, startDate: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                    <input
                      type="date"
                      value={options.endDate}
                      onChange={(e) => setOptions(prev => ({ ...prev, endDate: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                )}
              </div>

              {/* Additional Options */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Options
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={options.includeCharts}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeCharts: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Include charts and visualizations (PDF only)
                    </span>
                  </label>
                  
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={options.includeNotes}
                      onChange={(e) => setOptions(prev => ({ ...prev, includeNotes: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Include transaction notes
                    </span>
                  </label>
                </div>

                {options.format === 'pdf' && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300">Paper Size</label>
                      <select
                        value={options.paperSize}
                        onChange={(e) =>
                          setOptions(prev => ({ ...prev, paperSize: e.target.value as ExportOptions['paperSize'] }))
                        }
                        className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      >
                        {PAPER_SIZE_OPTIONS.map(size => (
                          <option key={size} value={size}>
                            {PAPER_SIZE_LABELS[size]}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300">Orientation</label>
                      <select
                        value={options.orientation}
                        onChange={(e) =>
                          setOptions(prev => ({ ...prev, orientation: e.target.value as ExportOptions['orientation'] }))
                        }
                        className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      >
                        {ORIENTATION_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {ORIENTATION_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Eye size={16} />
                Preview
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Export
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
