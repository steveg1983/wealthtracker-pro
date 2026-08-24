import React, { useState } from 'react';
import { DownloadIcon, PdfIcon } from '../icons';
import { exportTransactionsToCSV, downloadCSV } from '../../utils/csvExport';
import { generatePDFReport } from '../../utils/pdfExport';
import { computeExpenseCategoryNetTotals } from '../../utils/categoryNetting';
import { buildCategoryNameLookup } from '../../utils/categoryNames';
import { selectTopTransactions } from '../../utils/topTransactions';
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
      // The SAME netted totals the Spending by category report lists, so the
      // printed table and the screen agree row for row. It is netted per
      // category and drops any whose refunds exceeded its spending (a share of
      // spending cannot be negative), so these rows can add up to MORE than
      // `flows.expenses` — the summary's Expenses figure. That divergence is
      // real and deliberate; generatePDFReport compares the two and prints the
      // same disclosure the screen shows, so neither figure is presented as
      // the other.
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
          // The SAME selection the report shows on screen (real income and
          // spending only — no transfer legs, no revaluations), so the printed
          // list and the screen can never disagree. categoryLabel: the PDF
          // prints names, never category ids.
          topTransactions: selectTopTransactions(rows, categories)
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
      {/* Two QUIET OUTLINES (Design, 24 Aug §5): Export PDF wore a solid
          red — the expense/destructive token as furniture on a routine
          action, the loudest thing on five report pages — and CSV a navy
          fill beside it. The two are the same kind of action and look
          alike; neither has earned a primary. */}
      <button
        type="button"
        onClick={exportCSV}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <DownloadIcon size={16} />
        Export CSV
      </button>
      <button
        type="button"
        onClick={exportPDF}
        disabled={isGenerating}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PdfIcon size={16} />
        {isGenerating ? 'Generating…' : 'Export PDF'}
      </button>
    </div>
  );
}
