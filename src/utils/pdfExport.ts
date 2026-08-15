// Dynamic imports for heavy libraries
let jsPDF: typeof import('jspdf').default | null = null;
let html2canvas: typeof import('html2canvas').default | null = null;
import { Transaction, Account } from '../types';
import { formatCurrency as formatCurrencyDecimal } from './currency-decimal';
import { formatDecimal } from './decimal-format';
import { toDecimal } from './decimal';
import { createScopedLogger } from '../loggers/scopedLogger';
import { getDateLocale } from '../utils/dateFormatter';

type JsPDFInstance = InstanceType<typeof import('jspdf').default>;
type RGB = readonly [number, number, number];

const BLACK: RGB = [0, 0, 0];
const GREEN: RGB = [34, 197, 94];
const RED: RGB = [239, 68, 68];
const GREY: RGB = [100, 100, 100];
const HEADER_TEXT: RGB = [75, 85, 99];
const HEADER_FILL: RGB = [243, 244, 246];
const ZEBRA_FILL: RGB = [249, 250, 251];

/**
 * A transaction as it appears in a report table. `categoryLabel` carries the
 * resolved category NAME — the stored `category` is a UUID and must never be
 * printed.
 */
export interface ReportTransaction extends Transaction {
  categoryLabel?: string;
}

interface ReportData {
  title: string;
  dateRange: string;
  summary: {
    income: number;
    expenses: number;
    netIncome: number;
    savingsRate: number;
  };
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  topTransactions: ReportTransaction[];
  chartElements?: HTMLElement[];
}

/** One column of a PDF table. */
interface PdfTableColumn<Row> {
  header: string;
  /** Offset from the left margin, in mm. */
  x: number;
  cell: (row: Row) => string;
  /** Text colour for the cell; black when absent. */
  colour?: (row: Row) => RGB;
  /**
   * Truncate the cell to this many characters (an ellipsis replaces the rest).
   * A PDF column has a fixed width and jsPDF will happily draw straight over
   * its neighbour, so anything free-text says how wide it may be.
   */
  maxChars?: number;
}

interface PdfTableSpec<Row> {
  columns: Array<PdfTableColumn<Row>>;
  rows: Row[];
  /** Point size for body rows; the header's 10pt carries over when absent. */
  rowFontSize?: number;
}

function truncate(text: string, maxChars: number | undefined): string {
  if (maxChars === undefined || text.length <= maxChars) return text;
  return `${text.substring(0, maxChars)}...`;
}

/**
 * The page-level machinery every PDF this app writes needs: a cursor that
 * knows where the page ends, a currency formatter fixed to ONE currency for
 * the whole document, and a table that repeats its header when it spills.
 *
 * It exists because content that runs past the first page was being written
 * off the bottom of it — silently, so a 400-transaction export looked like a
 * 30-transaction one. Every write goes through `checkPageBreak`; nothing
 * advances the cursor without asking.
 */
interface PdfWriter {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly margin: number;
  /** The current baseline, in mm from the top of the page. */
  y: number;
  /** Start a new page when `requiredHeight` mm will not fit. */
  checkPageBreak(requiredHeight: number): boolean;
  /** Money, in the document's currency. Never a raw number. */
  money(amount: number): string;
  /** A section heading, with the page break it needs to stay with its table. */
  heading(text: string): void;
  table<Row>(spec: PdfTableSpec<Row>): void;
}

function createPdfWriter(pdf: JsPDFInstance, currency: string): PdfWriter {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;

  const writer: PdfWriter = {
    pageWidth,
    pageHeight,
    margin,
    y: margin,

    checkPageBreak(requiredHeight: number): boolean {
      if (writer.y + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        writer.y = margin;
        return true;
      }
      return false;
    },

    money(amount: number): string {
      return formatCurrencyDecimal(amount, currency);
    },

    heading(text: string): void {
      writer.checkPageBreak(60);
      pdf.setFontSize(16);
      pdf.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      pdf.text(text, margin, writer.y);
      writer.y += 10;
    },

    table<Row>({ columns, rows, rowFontSize }: PdfTableSpec<Row>): void {
      const drawHeader = (): void => {
        pdf.setFontSize(10);
        pdf.setFillColor(HEADER_FILL[0], HEADER_FILL[1], HEADER_FILL[2]);
        pdf.rect(margin, writer.y, pageWidth - 2 * margin, 8, 'F');
        pdf.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
        for (const column of columns) {
          pdf.text(column.header, margin + column.x, writer.y + 5);
        }
        writer.y += 10;
        pdf.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      };

      drawHeader();

      rows.forEach((row, index) => {
        // A spilled table without its header is a wall of unlabelled numbers.
        if (writer.checkPageBreak(8)) {
          drawHeader();
        }

        if (index % 2 === 0) {
          pdf.setFillColor(ZEBRA_FILL[0], ZEBRA_FILL[1], ZEBRA_FILL[2]);
          pdf.rect(margin, writer.y - 5, pageWidth - 2 * margin, 8, 'F');
        }

        if (rowFontSize !== undefined) {
          pdf.setFontSize(rowFontSize);
        }

        for (const column of columns) {
          const text = truncate(column.cell(row), column.maxChars);
          const colour = column.colour?.(row);
          if (colour) {
            pdf.setTextColor(colour[0], colour[1], colour[2]);
            pdf.text(text, margin + column.x, writer.y);
            pdf.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
          } else {
            pdf.text(text, margin + column.x, writer.y);
          }
        }

        writer.y += 8;
      });
    }
  };

  return writer;
}

async function loadJsPDF(): Promise<typeof import('jspdf').default> {
  if (!jsPDF) {
    const module = await import('jspdf');
    jsPDF = module.default;
  }
  return jsPDF;
}

async function loadHtml2Canvas(): Promise<typeof import('html2canvas').default> {
  if (!html2canvas) {
    const module = await import('html2canvas');
    html2canvas = module.default;
  }
  return html2canvas;
}

/** "Generated on …" — the same stamp on every document this app writes. */
function stampFooter(pdf: JsPDFInstance, writer: PdfWriter): void {
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  const footerText = `Generated on ${new Date().toLocaleDateString(getDateLocale())} at ${new Date().toLocaleTimeString(getDateLocale())}`;
  pdf.text(footerText, writer.pageWidth / 2, writer.pageHeight - 10, { align: 'center' });
}

export async function generatePDFReport(data: ReportData, _accounts: Account[]): Promise<void> {
  const JsPDFClass = await loadJsPDF();
  const capture = await loadHtml2Canvas();

  const pdf = new JsPDFClass('p', 'mm', 'a4');
  const writer = createPdfWriter(pdf, 'GBP');
  const { pageWidth, margin } = writer;

  const formatCurrency = (amount: number): string => writer.money(amount);
  const formatPercentage = (value: number, decimals: number = 1): string => formatDecimal(value, decimals);

  // Title
  pdf.setFontSize(24);
  pdf.setTextColor(33, 150, 243); // Primary blue color
  pdf.text(data.title, pageWidth / 2, writer.y, { align: 'center' });
  writer.y += 10;

  // Date range
  pdf.setFontSize(12);
  pdf.setTextColor(GREY[0], GREY[1], GREY[2]);
  pdf.text(data.dateRange, pageWidth / 2, writer.y, { align: 'center' });
  writer.y += 15;

  // Summary Section
  writer.heading('Financial Summary');

  // Summary boxes
  const boxWidth = (pageWidth - 2 * margin - 15) / 4;
  const boxHeight = 20;
  const boxY = writer.y;

  // Income box
  pdf.setFillColor(236, 253, 245); // Light green
  pdf.rect(margin, boxY, boxWidth, boxHeight, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(GREY[0], GREY[1], GREY[2]);
  pdf.text('Income', margin + 2, boxY + 5);
  pdf.setFontSize(14);
  pdf.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  pdf.text(formatCurrency(data.summary.income), margin + 2, boxY + 13);

  // Expenses box
  pdf.setFillColor(254, 242, 242); // Light red
  pdf.rect(margin + boxWidth + 5, boxY, boxWidth, boxHeight, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(GREY[0], GREY[1], GREY[2]);
  pdf.text('Expenses', margin + boxWidth + 7, boxY + 5);
  pdf.setFontSize(14);
  pdf.setTextColor(RED[0], RED[1], RED[2]);
  pdf.text(formatCurrency(data.summary.expenses), margin + boxWidth + 7, boxY + 13);

  // Net Income box
  const netIncomeColor = data.summary.netIncome >= 0 ? [236, 253, 245] as const : [254, 242, 242] as const;
  const netIncomeTextColor = data.summary.netIncome >= 0 ? GREEN : RED;
  pdf.setFillColor(netIncomeColor[0], netIncomeColor[1], netIncomeColor[2]);
  pdf.rect(margin + 2 * (boxWidth + 5), boxY, boxWidth, boxHeight, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(GREY[0], GREY[1], GREY[2]);
  pdf.text('Net Income', margin + 2 * (boxWidth + 5) + 2, boxY + 5);
  pdf.setFontSize(14);
  pdf.setTextColor(netIncomeTextColor[0], netIncomeTextColor[1], netIncomeTextColor[2]);
  pdf.text(formatCurrency(data.summary.netIncome), margin + 2 * (boxWidth + 5) + 2, boxY + 13);

  // Savings Rate box
  pdf.setFillColor(254, 249, 195); // Light yellow
  pdf.rect(margin + 3 * (boxWidth + 5), boxY, boxWidth, boxHeight, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(GREY[0], GREY[1], GREY[2]);
  pdf.text('Savings Rate', margin + 3 * (boxWidth + 5) + 2, boxY + 5);
  pdf.setFontSize(14);
  pdf.setTextColor(245, 158, 11); // Yellow
  pdf.text(`${formatPercentage(data.summary.savingsRate, 1)}%`, margin + 3 * (boxWidth + 5) + 2, boxY + 13);

  writer.y += boxHeight + 15;

  // Charts (if provided)
  if (data.chartElements && data.chartElements.length > 0) {
    writer.checkPageBreak(100);

    for (const chartElement of data.chartElements) {
      try {
        const canvas = await capture(chartElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        writer.checkPageBreak(imgHeight);
        pdf.addImage(imgData, 'PNG', margin, writer.y, imgWidth, imgHeight);
        writer.y += imgHeight + 10;
      } catch (error) {
        pdfExportLogger.error('Error capturing chart for PDF', error);
      }
    }
  }

  // Category Breakdown Table
  writer.heading('Expense Categories');
  writer.table({
    columns: [
      { header: 'Category', x: 2, cell: entry => entry.category },
      { header: 'Amount', x: 80, cell: entry => formatCurrency(entry.amount) },
      { header: 'Percentage', x: 130, cell: entry => `${formatPercentage(entry.percentage, 1)}%` }
    ],
    rows: data.categoryBreakdown
  });

  /**
   * Two Expenses figures are printed on this report — the summary box above
   * and the table just printed — and they need not agree: the breakdown nets
   * each category and can only list POSITIVE spend, so a category whose
   * refunds exceeded its spending is left out and the rows can add up to more
   * than the period's total. The screen says so wherever this happens
   * (SpendingByCategoryReport); a printed report that a reader cannot
   * interrogate must never be the less honest of the two.
   *
   * Decimal throughout: this is money, and the reader is being told two money
   * figures disagree — the comparison itself cannot be the thing that drifts.
   * Where they agree, nothing is printed at all.
   */
  const listedTotal = data.categoryBreakdown.reduce(
    (sum, entry) => sum.plus(toDecimal(entry.amount)),
    toDecimal(0)
  );
  if (!listedTotal.equals(toDecimal(data.summary.expenses))) {
    const note =
      `Total spending for the period is ${formatCurrency(data.summary.expenses)}. ` +
      `The categories listed add up to ${formatCurrency(listedTotal.toNumber())}, and ` +
      `the percentages are shares of that: a category whose refunds cancelled its ` +
      `spending nets to zero or less, so it cannot be listed as spend.`;
    writer.y += 2;
    pdf.setFontSize(8);
    pdf.setTextColor(GREY[0], GREY[1], GREY[2]);
    const lines: string[] = pdf.splitTextToSize(note, pageWidth - 2 * margin);
    for (const line of lines) {
      writer.checkPageBreak(6);
      pdf.text(line, margin, writer.y);
      writer.y += 4;
    }
    // Leave the page as the note found it.
    pdf.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    pdf.setFontSize(10);
  }

  writer.y += 10;

  // Top Transactions
  writer.heading('Top Transactions');
  writer.table({
    columns: [
      { header: 'Date', x: 2, cell: t => new Date(t.date).toLocaleDateString(getDateLocale()) },
      { header: 'Description', x: 25, cell: t => t.description, maxChars: 30 },
      // Never the raw id: the caller resolves the name, blank if it has none.
      { header: 'Category', x: 100, cell: t => t.categoryLabel ?? '' },
      {
        header: 'Amount',
        x: 140,
        // Amounts are stored signed; derive the sign from the value so incoming
        // transfers show '+'
        cell: t => `${t.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(t.amount))}`,
        colour: t => (t.type === 'income' ? GREEN : RED)
      }
    ],
    rows: data.topTransactions.slice(0, 10),
    rowFontSize: 9
  });

  stampFooter(pdf, writer);

  // Save the PDF
  const filename = `financial-report-${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);
}

/**
 * The same report without its charts (faster).
 *
 * Returns the promise rather than dropping it: a rejected generation that
 * nobody awaits is an unhandled rejection and a file that never appears, with
 * the caller told nothing.
 */
export function generateSimplePDFReport(data: ReportData, accounts: Account[]): Promise<void> {
  const reportData = {
    ...data,
    chartElements: undefined
  };
  return generatePDFReport(reportData, accounts);
}

/**
 * A transaction as it appears in the Export Data listing: the resolved
 * category and account NAMES travel with it, because both are stored as ids
 * and an id in an exported document is worthless to the person reading it.
 */
export interface DataExportTransaction extends Transaction {
  categoryLabel: string;
  accountLabel: string;
}

export interface DataExportPdfData {
  title: string;
  /** The period, in words, printed under the title. */
  dateRange: string;
  /** The user's display currency — every figure in the file is in it. */
  currency: string;
  /** Absent when the user did not ask for transactions. */
  transactions?: DataExportTransaction[];
  /** Absent when the user did not ask for accounts. */
  accounts?: Account[];
  filename: string;
}

/**
 * The Export Data page's PDF: a listing, not a report — every transaction in
 * the chosen range, and/or every account, in the user's own currency.
 *
 * It shares this file's page machinery deliberately. The version it replaces
 * had no page breaks at all (everything past the first page was written into
 * the void), printed the sentence "Charts would be rendered here from DOM
 * elements" into the document, and formatted every figure as US dollars.
 */
export async function generateDataExportPDF(data: DataExportPdfData): Promise<void> {
  const JsPDFClass = await loadJsPDF();
  const pdf = new JsPDFClass('p', 'mm', 'a4');
  const writer = createPdfWriter(pdf, data.currency);
  const { pageWidth, margin } = writer;

  pdf.setFontSize(24);
  pdf.setTextColor(33, 150, 243);
  pdf.text(data.title, pageWidth / 2, writer.y, { align: 'center' });
  writer.y += 10;

  pdf.setFontSize(12);
  pdf.setTextColor(GREY[0], GREY[1], GREY[2]);
  pdf.text(data.dateRange, pageWidth / 2, writer.y, { align: 'center' });
  writer.y += 15;

  if (data.accounts) {
    writer.heading('Accounts');
    writer.table({
      columns: [
        { header: 'Account', x: 2, cell: account => account.name, maxChars: 34 },
        { header: 'Type', x: 70, cell: account => account.type },
        { header: 'Currency', x: 100, cell: account => account.currency || '' },
        {
          header: 'Balance',
          x: 130,
          cell: account => writer.money(account.balance),
          colour: account => (account.balance < 0 ? RED : BLACK)
        }
      ],
      rows: data.accounts,
      rowFontSize: 9
    });

    // Decimal: a total printed beside the figures it totals cannot be the one
    // thing on the page that drifted.
    const total = data.accounts.reduce((sum, account) => sum.plus(toDecimal(account.balance)), toDecimal(0));
    writer.checkPageBreak(12);
    writer.y += 4;
    pdf.setFontSize(10);
    pdf.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    pdf.text(`Total of ${data.accounts.length} accounts: ${writer.money(total.toNumber())}`, margin, writer.y);
    writer.y += 12;
  }

  if (data.transactions) {
    writer.heading('Transactions');
    writer.table({
      columns: [
        { header: 'Date', x: 2, cell: t => new Date(t.date).toLocaleDateString(getDateLocale()) },
        { header: 'Description', x: 24, cell: t => t.description, maxChars: 30 },
        { header: 'Category', x: 78, cell: t => t.categoryLabel, maxChars: 22 },
        { header: 'Account', x: 118, cell: t => t.accountLabel, maxChars: 16 },
        {
          header: 'Amount',
          x: 148,
          // Stored signed, printed signed: an export that re-signs its own
          // numbers is an export nobody can reconcile against the register.
          cell: t => `${t.amount < 0 ? '-' : '+'}${writer.money(Math.abs(t.amount))}`,
          colour: t => (t.amount < 0 ? RED : GREEN)
        }
      ],
      rows: data.transactions,
      rowFontSize: 9
    });

    const net = data.transactions.reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
    writer.checkPageBreak(12);
    writer.y += 4;
    pdf.setFontSize(10);
    pdf.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    pdf.text(
      `${data.transactions.length} transactions, netting ${writer.money(net.toNumber())}`,
      margin,
      writer.y
    );
    writer.y += 12;
  }

  // Every page gets its number, so a reader can tell a short file from a
  // truncated one.
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${page} of ${pageCount} — generated on ${new Date().toLocaleDateString(getDateLocale())}`,
      writer.pageWidth / 2,
      writer.pageHeight - 10,
      { align: 'center' }
    );
  }

  pdf.save(data.filename);
}

const pdfExportLogger = createScopedLogger('PDFExport');
