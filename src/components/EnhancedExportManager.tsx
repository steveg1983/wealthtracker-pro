import React, { useState, useMemo } from 'react';
import { FileTextIcon, DownloadIcon, CalendarIcon, FileSpreadsheetIcon, FilePlusIcon, XIcon, PieChartIcon } from './icons';
import DatePicker from './common/DatePicker';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { expandSplitTransactions } from '../utils/transactionSplits';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { formatDecimal } from '../utils/decimal-format';
import { toDecimal, type DecimalInstance } from '../utils/decimal';
import { buildCategoryNameLookup } from '../utils/categoryNames';
import { csvDocument } from '../utils/csvExport';

// Dynamic imports for heavy libraries (loaded on demand)
let jsPDF: typeof import('jspdf').jsPDF | null = null;
let autoTable: typeof import('jspdf-autotable').default | null = null;
let XLSX: typeof import('xlsx') | null = null;

type ExportFormat = 'pdf' | 'excel' | 'csv';

/**
 * The report shapes this builder can actually GENERATE.
 *
 * There were three more — Tax Summary, Investment Performance, Net Worth
 * Statement — offered as template cards with no generate branch behind any of
 * them. Choosing one produced a four-line PDF with a title and a summary and
 * nothing else, which is a worse outcome than the feature not being there.
 */
type ReportType = 'transactions' | 'budget';

interface ExportOptions {
  format: ExportFormat;
  reportType: ReportType;
  dateRange: 'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'custom';
  startDate?: string;
  endDate?: string;
  accounts: string[];
  categories: string[];
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
    icon: CalendarIcon,
    description: 'Professional bank-style monthly statement',
    reportType: 'transactions' as ReportType,
    defaults: {
      dateRange: 'lastMonth' as const
    }
  },
  {
    id: 'budget-analysis',
    name: 'Budget Analysis',
    icon: PieChartIcon,
    description: 'Budget vs actual spending analysis',
    reportType: 'budget' as ReportType,
    defaults: {
      dateRange: 'thisMonth' as const
    }
  }
];

export default function EnhancedExportManager(): React.JSX.Element {
  const { accounts, transactions: rawTransactions, transactionSplits, budgets, categories } = useApp();
  const { showError, showSuccess } = useToast();
  // Exports work on the split-EXPANDED view (one row per split line) so
  // category summaries and budget analysis count split lines correctly.
  const transactions = useMemo(
    () => expandSplitTransactions(rawTransactions, transactionSplits),
    [rawTransactions, transactionSplits]
  );
  // Transactions and budgets both store category IDS. A UUID is not a category
  // name, and must not reach a page, a cell or a CSV column.
  const categoryName = useMemo(() => buildCategoryNameLookup(categories), [categories]);
  const { formatCurrency } = useCurrencyDecimal();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    reportType: 'transactions',
    dateRange: 'thisMonth',
    accounts: accounts.map(a => a.id),
    categories: [],
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
      case 'lastMonth': {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case 'thisYear':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'lastYear': {
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
      }
      case 'custom':
        return {
          start: options.startDate ? new Date(options.startDate) : now,
          end: options.endDate ? new Date(options.endDate) : now
        };
      default:
        return { start: new Date(2000, 0, 1), end: now };
    }
  };

  const getFilteredTransactions = () => {
    const dateRange = getDateRange();
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= dateRange.start &&
             transactionDate <= dateRange.end &&
             (options.accounts.length === 0 || options.accounts.includes(t.accountId)) &&
             (options.categories.length === 0 || options.categories.includes(t.category));
    });
  };

  /**
   * Period totals, in Decimal. These are money: a float sum of a few thousand
   * signed amounts drifts, and a report whose Net does not equal its Income
   * minus its Expenses is a report nobody can use.
   */
  const summarise = (rows: ReturnType<typeof getFilteredTransactions>) => {
    let income = toDecimal(0);
    let expenses = toDecimal(0);
    for (const t of rows) {
      const amount = toDecimal(t.amount);
      if (amount.greaterThan(0)) income = income.plus(amount);
      else expenses = expenses.plus(amount.negated());
    }
    return { income, expenses, net: income.minus(expenses) };
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

    const filteredTransactions = getFilteredTransactions();

    // Add summary section
    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text('Summary', 20, 45);

    const { income, expenses, net } = summarise(filteredTransactions);

    pdf.setFontSize(10);
    pdf.text(`Total Income: ${formatCurrency(income)}`, 20, 55);
    pdf.text(`Total Expenses: ${formatCurrency(expenses)}`, 20, 62);
    pdf.text(`Net: ${formatCurrency(net)}`, 20, 69);
    pdf.text(`Transactions: ${filteredTransactions.length}`, 20, 76);

    // Add transactions table
    if (options.reportType === 'transactions') {
      const tableData = filteredTransactions.map(t => [
        format(new Date(t.date), 'MMM d, yyyy'),
        t.description,
        categoryName(t.category),
        accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
        formatCurrency(toDecimal(t.amount).abs()),
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
        const budgeted = toDecimal(b.amount);
        const spent = filteredTransactions
          .filter(t => t.category === b.categoryId && t.amount < 0)
          .reduce((sum, t) => sum.plus(toDecimal(t.amount).negated()), toDecimal(0));
        const percentage = budgeted.greaterThan(0) ? spent.dividedBy(budgeted).times(100) : toDecimal(0);

        return [
          categoryName(b.categoryId),
          formatCurrency(budgeted),
          formatCurrency(spent),
          formatCurrency(budgeted.minus(spent)),
          `${formatDecimal(percentage, 1)}%`
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
    const filteredTransactions = getFilteredTransactions();
    const { income, expenses, net } = summarise(filteredTransactions);

    // Summary Sheet
    const summaryData = [
      ['WealthTracker Export Report'],
      [''],
      ['Report Type:', getReportTitle()],
      ['Date Range:', `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`],
      ['Generated:', format(new Date(), 'MMM d, yyyy HH:mm')],
      [''],
      ['Summary Statistics'],
      ['Total Income:', income.toNumber()],
      ['Total Expenses:', expenses.toNumber()],
      ['Net Amount:', net.toNumber()],
      ['Transaction Count:', filteredTransactions.length]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Transactions Sheet
    //
    // There is no Balance column. There used to be, and every row of it held a
    // literal 0 with a comment saying the running balance would be worked out
    // "in production" — a column of zeros in a financial export is worse than
    // no column, because a reader has no way to tell it is not their balance.
    if (filteredTransactions.length > 0) {
      const transactionData = [
        ['Date', 'Description', 'Category', 'Account', 'Amount', 'Type'],
        ...filteredTransactions.map(t => [
          format(new Date(t.date), 'yyyy-MM-dd'),
          t.description,
          categoryName(t.category),
          accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
          t.amount,
          t.amount > 0 ? 'Income' : 'Expense'
        ])
      ];

      const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
      // Header styling was attempted here and did nothing: cell `.s` styles are
      // a feature of the paid SheetJS build, and this project pins the
      // community one. It was removed rather than left looking deliberate.
      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');
    }

    // Budget Sheet (if applicable)
    if (options.reportType === 'budget' && budgets.length > 0) {
      const budgetData = [
        ['Category', 'Budgeted', 'Spent', 'Remaining', '% Used', 'Status'],
        ...budgets.map(b => {
          const budgeted = toDecimal(b.amount);
          const spent = filteredTransactions
            .filter(t => t.category === b.categoryId && t.amount < 0)
            .reduce((sum, t) => sum.plus(toDecimal(t.amount).negated()), toDecimal(0));
          const remaining = budgeted.minus(spent);
          const percentage = budgeted.greaterThan(0) ? spent.dividedBy(budgeted).times(100) : toDecimal(0);

          return [
            categoryName(b.categoryId),
            budgeted.toNumber(),
            spent.toNumber(),
            remaining.toNumber(),
            percentage.toNumber(),
            percentage.greaterThan(100) ? 'Over Budget' : percentage.greaterThan(80) ? 'Warning' : 'On Track'
          ];
        })
      ];

      const budgetSheet = XLSX.utils.aoa_to_sheet(budgetData);
      XLSX.utils.book_append_sheet(workbook, budgetSheet, 'Budget Analysis');
    }

    // Category Summary Sheet
    const categoryTotals = new Map<string, { total: DecimalInstance; count: number }>();
    filteredTransactions.forEach(t => {
      const key = t.category;
      const current = categoryTotals.get(key) ?? { total: toDecimal(0), count: 0 };
      categoryTotals.set(key, { total: current.total.plus(toDecimal(t.amount)), count: current.count + 1 });
    });

    const categoryData = [
      ['Category', 'Total Amount', 'Transaction Count', 'Average'],
      ...Array.from(categoryTotals.entries()).map(([category, { total, count }]) => [
        categoryName(category),
        total.toNumber(),
        count,
        count > 0 ? total.dividedBy(count).toNumber() : 0
      ])
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
        if (!XLSX) throw new Error('The spreadsheet library did not load.');
        XLSX.writeFile(workbook, `${getFileName()}.xlsx`);
      } else {
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
      showSuccess('Your report has been downloaded.', 'Export ready');
    } catch (error) {
      // A failure used to reach console.error and nowhere else: the modal
      // closed its spinner and no file appeared, with nothing said.
      showError(error);
    } finally {
      setIsExporting(false);
    }
  };

  const generateCSV = () => {
    const filteredTransactions = getFilteredTransactions();

    // Every field quoted (csvDocument) — the description was the only one that
    // used to be, so a comma in a category or an account name silently shifted
    // every column after it.
    return csvDocument([
      ['Date', 'Description', 'Category', 'Account', 'Amount', 'Type'],
      ...filteredTransactions.map(t => [
        format(new Date(t.date), 'yyyy-MM-dd'),
        t.description,
        categoryName(t.category),
        accounts.find(a => a.id === t.accountId)?.name || 'Unknown',
        formatDecimal(toDecimal(t.amount), 2),
        t.amount > 0 ? 'Income' : 'Expense'
      ])
    ]);
  };

  const getReportTitle = () => {
    switch (options.reportType) {
      case 'budget': return 'Budget Analysis Report';
      default: return 'Transaction Report';
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
        className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] transition-colors flex items-center gap-2"
      >
        <DownloadIcon size={20} />
        Advanced Export
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Advanced Export
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Close advanced export"
                >
                  <XIcon size={20} />
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
                            ? 'border-primary bg-primary/10 dark:bg-gray-700/50'
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
                    className={`flex-1 justify-center p-3 rounded-lg border-2 transition-all ${
                      options.format === 'pdf'
                        ? 'border-primary bg-primary/10 dark:bg-gray-700/50'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <FileTextIcon size={24} className="mx-auto mb-2 text-red-500" />
                    <p className="text-sm font-medium">PDF</p>
                    <p className="text-xs text-gray-500 mt-1">Professional reports</p>
                  </button>

                  <button
                    onClick={() => setOptions(prev => ({ ...prev, format: 'excel' }))}
                    className={`flex-1 justify-center p-3 rounded-lg border-2 transition-all ${
                      options.format === 'excel'
                        ? 'border-primary bg-primary/10 dark:bg-gray-700/50'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <FileSpreadsheetIcon size={24} className="mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium">Excel</p>
                    <p className="text-xs text-gray-500 mt-1">Advanced analysis</p>
                  </button>

                  <button
                    onClick={() => setOptions(prev => ({ ...prev, format: 'csv' }))}
                    className={`flex-1 justify-center p-3 rounded-lg border-2 transition-all ${
                      options.format === 'csv'
                        ? 'border-primary bg-primary/10 dark:bg-gray-700/50'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {/* PDF's red and Excel's green are the two formats with a
                        colour the world already agrees on. CSV has none, and a
                        borrowed blue is not one (stock-blue ruling, 28 Aug
                        2026) — the word beneath the icon is what names it. */}
                    <FilePlusIcon size={24} className="mx-auto mb-2 text-gray-600 dark:text-gray-400" />
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
                          ? 'border-primary bg-primary/10 dark:bg-gray-700/50 text-gray-900 dark:text-white'
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

                {/* dd/mm/yyyy everywhere — a native date input renders in the
                    browser's locale, not the app's. */}
                {options.dateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <DatePicker
                      value={options.startDate ?? ''}
                      onChange={(val) => setOptions(prev => ({ ...prev, startDate: val }))}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      aria-label="Export start date"
                    />
                    <DatePicker
                      value={options.endDate ?? ''}
                      onChange={(val) => setOptions(prev => ({ ...prev, endDate: val }))}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      aria-label="Export end date"
                    />
                  </div>
                )}
              </div>

              {/* Page setup. "Include charts" and "Include transaction notes"
                  used to sit here; both were written to state and never read by
                  either generator. */}
              {options.format === 'pdf' && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Page setup
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300" htmlFor="export-paper-size">
                        Paper Size
                      </label>
                      <select
                        id="export-paper-size"
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
                      <label className="text-sm text-gray-700 dark:text-gray-300" htmlFor="export-orientation">
                        Orientation
                      </label>
                      <select
                        id="export-orientation"
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
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end">
              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void handleExport(); }}
                  disabled={isExporting}
                  className="px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <DownloadIcon size={16} />
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
