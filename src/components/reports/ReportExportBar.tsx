import React, { useState } from 'react';
import { DownloadIcon, PdfIcon } from '../icons';
import { exportTransactionsToCSV, downloadCSV } from '../../utils/csvExport';
import { generatePDFReport } from '../../utils/pdfExport';
import { computeExpenseCategoryNetTotals } from '../../utils/categoryNetting';
import { buildCategoryNameLookup } from '../../utils/categoryNames';
import { toDecimal } from '../../utils/decimal';
import { createScopedLogger } from '../../loggers/scopedLogger';
import type { Account, Category } from '../../types';
import type { IncomeExpenseBreakdown } from '../../utils/incomeExpense';
import type { SplitExpandedTransaction } from '../../utils/transactionSplits';

const exportLogger = createScopedLogger('ReportExport');

/**
 * CSV and PDF export for a report — the same two buttons, the same figures,
 * wherever they appear. The PDF carries the report's own charts when it has
 * any (refs passed in); a report without charts simply exports the tables.
 */
export default function ReportExportBar({
  title,
  dateRange,
  rows,
  flows,
  categories,
  accounts,
  charts,
}: {
  /** Title printed on the PDF. */
  title: string;
  /** The period, in words, printed under the title. */
  dateRange: string;
  /** The report's period- and account-filtered rows. */
  rows: SplitExpandedTransaction[];
  flows: IncomeExpenseBreakdown;
  categories: Category[];
  accounts: Account[];
  charts?: Array<React.RefObject<HTMLDivElement | null>>;
}): React.JSX.Element {
  const [isGenerating, setIsGenerating] = useState(false);

  const exportCSV = (): void => {
    try {
      // categories resolve the Category column to a name — a UUID in a
      // spreadsheet is worthless.
      const csv = exportTransactionsToCSV(rows, accounts, categories);
      downloadCSV(csv, `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      exportLogger.error('Error exporting CSV', error);
      alert('Failed to export CSV. Please try again.');
    }
  };

  const exportPDF = async (): Promise<void> => {
    setIsGenerating(true);
    try {
      const categoryName = buildCategoryNameLookup(categories);
      const netTotals = computeExpenseCategoryNetTotals(rows, categories);
      const totalExpenses = netTotals.reduce((sum, entry) => sum.plus(toDecimal(entry.value)), toDecimal(0));
      const netIncome = flows.income.minus(flows.expenses);

      const chartElements = (charts ?? [])
        .map(ref => ref.current)
        .filter((element): element is HTMLDivElement => element !== null);

      await generatePDFReport(
        {
          title,
          dateRange,
          summary: {
            income: flows.income.toNumber(),
            expenses: flows.expenses.toNumber(),
            netIncome: netIncome.toNumber(),
            savingsRate: flows.income.greaterThan(0)
              ? netIncome.dividedBy(flows.income).times(100).toNumber()
              : 0,
          },
          categoryBreakdown: netTotals.map(({ name, value }) => ({
            category: name,
            amount: value,
            percentage: totalExpenses.greaterThan(0)
              ? toDecimal(value).dividedBy(totalExpenses).times(100).toNumber()
              : 0,
          })),
          // categoryLabel: the PDF prints names, never category ids.
          topTransactions: [...rows]
            .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
            .slice(0, 10)
            .map(t => ({ ...t, categoryLabel: categoryName(t.category) })),
          chartElements: chartElements.length > 0 ? chartElements : undefined,
        },
        accounts
      );
    } catch (error) {
      exportLogger.error('Error generating PDF', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={exportCSV}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors"
      >
        <DownloadIcon size={16} />
        Export CSV
      </button>
      <button
        type="button"
        onClick={exportPDF}
        disabled={isGenerating}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PdfIcon size={16} />
        {isGenerating ? 'Generating…' : 'Export PDF'}
      </button>
    </div>
  );
}
