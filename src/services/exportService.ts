import type { Transaction, Account, Category } from '../types';
import type { PeriodKey } from '../hooks/usePeriod';
import { formatDecimal } from '../utils/decimal-format';
import { buildCategoryNameLookup } from '../utils/categoryNames';
import { createScopedLogger, type ScopedLogger } from '../loggers/scopedLogger';
import { preferences } from './preferencesService';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const TEMPLATES_KEY = 'export-templates';
/**
 * Set the first time this store is touched, and never unset.
 *
 * It is what separates "this browser has never seen the export page" from
 * "this user deleted every template". Without it the store could only be
 * judged by whether it was empty, so deleting the last template silently
 * brought the starters back — the templates were undeletable in practice
 * however many times you deleted them.
 */
const INITIALISED_KEY = 'export-templates-initialised';

export interface ExportServiceOptions {
  storage?: StorageLike | null;
  logger?: ScopedLogger;
  now?: () => Date;
  idGenerator?: () => string;
}

/** The formats this page can actually write. Nothing aspirational. */
export type ExportFormat = 'pdf' | 'csv' | 'qif' | 'ofx';

const EXPORT_FORMATS: readonly ExportFormat[] = ['pdf', 'csv', 'qif', 'ofx'];

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF document',
  csv: 'CSV spreadsheet',
  qif: 'QIF (Quicken / MS Money)',
  ofx: 'OFX (bank statement)'
};

export interface ExportOptions {
  /**
   * The period as a RULE, not as two fixed dates — resolved against today
   * every time the export runs.
   *
   * A template is a thing you come back to, and one holding the dates of the
   * month it was saved in answers the wrong question for the rest of its life.
   * Storing the rule is what makes "Monthly Summary" mean this month in
   * August as well as in the January it was saved. 'custom' is the escape
   * hatch for a genuinely fixed window, and only then are the two dates below
   * read.
   */
  range: PeriodKey;
  /** 'YYYY-MM-DD'. Read only when `range` is 'custom'. */
  customStart: string;
  /** 'YYYY-MM-DD'. Read only when `range` is 'custom'. */
  customEnd: string;
  format: ExportFormat;
  includeTransactions: boolean;
  includeAccounts: boolean;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  options: ExportOptions;
  /**
   * Seeded by the app rather than written by the user. A label, not a lock —
   * every template here is deletable, including these.
   */
  isStarter: boolean;
  createdAt: Date;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPeriodKey = (value: unknown): value is PeriodKey =>
  value === 'this-month' || value === 'last-month' || value === 'tax-year' ||
  value === 'last-12-months' || value === 'all' || value === 'custom';

const isExportFormat = (value: unknown): value is ExportFormat =>
  typeof value === 'string' && EXPORT_FORMATS.some(format => format === value);

const toBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toIsoDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Read a pair of stored absolute dates back as the rule they were most likely
 * standing in for, judged against the day the template was SAVED.
 *
 * Every template written before ranges became rules holds two fixed dates, and
 * throwing them away would silently change what those templates export. A
 * whole calendar month that was the saving month is "this month"; the month
 * before it is "last month"; a window opened on 6 April of the saving tax year
 * and still running is "tax year". Anything else keeps its exact dates as a
 * custom range — a guess about a window nobody can check is worse than the
 * dates the user actually chose.
 */
export function inferRelativeRange(
  start: Date,
  end: Date,
  reference: Date
): Pick<ExportOptions, 'range' | 'customStart' | 'customEnd'> {
  const custom = {
    range: 'custom' as const,
    customStart: toIsoDay(start),
    customEnd: toIsoDay(end)
  };

  const startsMonth = start.getDate() === 1;
  const lastDayOfStartMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const endsSameMonth =
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === lastDayOfStartMonth;

  if (startsMonth && endsSameMonth) {
    const monthsApart =
      (reference.getFullYear() - start.getFullYear()) * 12 + (reference.getMonth() - start.getMonth());
    if (monthsApart === 0) return { range: 'this-month', customStart: '', customEnd: '' };
    if (monthsApart === 1) return { range: 'last-month', customStart: '', customEnd: '' };
    return custom;
  }

  // UK tax year: 6 April to 5 April.
  const taxYearStart =
    reference.getMonth() > 3 || (reference.getMonth() === 3 && reference.getDate() >= 6)
      ? reference.getFullYear()
      : reference.getFullYear() - 1;
  if (
    start.getFullYear() === taxYearStart &&
    start.getMonth() === 3 &&
    start.getDate() === 6 &&
    end.getTime() >= reference.getTime()
  ) {
    return { range: 'tax-year', customStart: '', customEnd: '' };
  }

  return custom;
}

/**
 * Templates for the Export Data page, plus the two interchange writers (QIF and
 * OFX) that the page hands its already-filtered rows to.
 *
 * Nothing here builds a PDF or a CSV any more: those go through
 * utils/pdfExport and utils/csvExport, which is where the page-break, currency
 * and category-name handling that this file never had already lives.
 */
export class ExportService {
  private templates: ExportTemplate[] = [];
  private readonly storage: StorageLike | null;
  private readonly logger: ScopedLogger;
  private readonly nowProvider: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: ExportServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    this.logger = options.logger ?? createScopedLogger('ExportService');
    this.nowProvider = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? (() => Date.now().toString());
    this.initialise();
  }

  private initialise(): void {
    if (!this.storage) {
      this.templates = this.starterTemplates();
      return;
    }

    const stored = this.storage.getItem(TEMPLATES_KEY);
    const alreadyInitialised = this.storage.getItem(INITIALISED_KEY) === 'true' || stored !== null;

    if (stored !== null) {
      this.templates = this.parseTemplates(stored);
    }

    if (!alreadyInitialised) {
      this.templates = this.starterTemplates();
      this.saveData();
    } else if (this.storage.getItem(INITIALISED_KEY) !== 'true') {
      // An older store, initialised before the marker existed. Mark it now, so
      // that emptying it later is read as "emptied" rather than "never seen".
      this.storage.setItem(INITIALISED_KEY, 'true');
    }
  }

  private parseTemplates(raw: string): ExportTemplate[] {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(entry => this.parseTemplate(entry))
        .filter((template): template is ExportTemplate => template !== null);
    } catch (error) {
      this.logger.error('Error loading export templates', error);
      return [];
    }
  }

  /**
   * One stored record, migrated best-effort. A record we cannot make sense of
   * is dropped rather than half-restored: a template that silently exports
   * something other than what it says is worse than one that is gone.
   */
  private parseTemplate(entry: unknown): ExportTemplate | null {
    if (!isRecord(entry)) return null;
    const { id, name, description, options, createdAt, isStarter, isDefault } = entry;
    if (typeof id !== 'string' || typeof name !== 'string') return null;
    if (!isRecord(options)) return null;

    const created = parseDate(createdAt) ?? this.nowProvider();

    let range: PeriodKey;
    let customStart: string;
    let customEnd: string;
    if (isPeriodKey(options.range)) {
      range = options.range;
      customStart = typeof options.customStart === 'string' ? options.customStart : '';
      customEnd = typeof options.customEnd === 'string' ? options.customEnd : '';
    } else {
      const start = parseDate(options.startDate);
      const end = parseDate(options.endDate);
      if (start && end) {
        ({ range, customStart, customEnd } = inferRelativeRange(start, end, created));
      } else {
        range = 'this-month';
        customStart = '';
        customEnd = '';
      }
    }

    return {
      id,
      name,
      description: typeof description === 'string' ? description : '',
      // A format this page cannot write (the never-implemented xlsx and json
      // branches) falls back to CSV rather than failing at click time.
      options: {
        range,
        customStart,
        customEnd,
        format: isExportFormat(options.format) ? options.format : 'csv',
        includeTransactions: toBoolean(options.includeTransactions, true),
        includeAccounts: toBoolean(options.includeAccounts, false)
      },
      isStarter: toBoolean(isStarter, toBoolean(isDefault, false)),
      createdAt: created
    };
  }

  private saveData(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(TEMPLATES_KEY, JSON.stringify(this.templates));
      this.storage.setItem(INITIALISED_KEY, 'true');
    } catch (error) {
      this.logger.error('Error saving export templates', error);
    }
  }

  /**
   * The two starters, seeded once per browser.
   *
   * There used to be a third, "Investment Portfolio". It exported an
   * investments section that this page no longer has — holdings live in the
   * investments table and want a report of their own — so seeding it would be
   * handing every new user a template that produces an empty file.
   */
  private starterTemplates(): ExportTemplate[] {
    const createdAt = this.nowProvider();
    return [
      {
        id: 'monthly-summary',
        name: 'Monthly Summary',
        description: 'This month\'s transactions and account balances, as a PDF',
        options: {
          range: 'this-month',
          customStart: '',
          customEnd: '',
          format: 'pdf',
          includeTransactions: true,
          includeAccounts: true
        },
        isStarter: true,
        createdAt
      },
      {
        id: 'transaction-report',
        name: 'Transaction Report',
        description: 'This month\'s transactions as a spreadsheet',
        options: {
          range: 'this-month',
          customStart: '',
          customEnd: '',
          format: 'csv',
          includeTransactions: true,
          includeAccounts: false
        },
        isStarter: true,
        createdAt
      }
    ];
  }

  getTemplates(): ExportTemplate[] {
    // A copy: a getter that reorders the caller's own store is a trap.
    return [...this.templates].sort((a, b) => {
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  createTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt'>): ExportTemplate {
    const newTemplate: ExportTemplate = {
      ...template,
      id: this.idGenerator(),
      createdAt: this.nowProvider()
    };

    this.templates.push(newTemplate);
    this.saveData();
    return newTemplate;
  }

  /** Every template is deletable, starters included. */
  deleteTemplate(id: string): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;

    this.templates.splice(index, 1);
    this.saveData();
    return true;
  }

  /**
   * QIF, from rows the caller has already filtered and split-expanded.
   *
   * Pass `categories` so the L field carries the category NAME: a UUID in a
   * QIF file makes a category called "8f3c…" in whatever the user imports it
   * into.
   */
  exportToQIF(data: { transactions: Transaction[]; accounts: Account[]; categories?: Category[] }): string {
    // QIF spells a subcategory Parent:Child, unpadded.
    const categoryName = data.categories ? buildCategoryNameLookup(data.categories, ':') : null;
    let qifContent = '';

    // Export accounts first
    for (const account of data.accounts) {
      qifContent += '!Account\n';
      qifContent += `N${account.name}\n`;
      qifContent += `T${this.mapAccountType(account.type)}\n`;
      qifContent += `$${formatDecimal(account.balance, 2)}\n`;
      qifContent += '^\n';

      // Export transactions for this account
      const accountTransactions = data.transactions.filter(t => t.accountId === account.id);
      if (accountTransactions.length > 0) {
        qifContent += `!Type:${this.mapAccountType(account.type)}\n`;

        for (const transaction of accountTransactions) {
          const date = new Date(transaction.date);
          const qifDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;

          qifContent += `D${qifDate}\n`;
          // Amounts are stored signed (expenses negative), so emit as-is — no per-type '-' prefix
          qifContent += `T${formatDecimal(transaction.amount, 2)}\n`;
          qifContent += `P${transaction.description || ''}\n`;
          qifContent += `L${categoryName ? categoryName(transaction.category) : (transaction.category || 'Uncategorized')}\n`;

          if (transaction.notes) {
            qifContent += `M${transaction.notes}\n`;
          }

          qifContent += '^\n';
        }
      }
    }

    return qifContent;
  }

  // Export to OFX format
  exportToOFX(data: { transactions: Transaction[]; accounts: Account[] }): string {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    let ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:103
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:${now}

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${now}
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${now}
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
`;

    for (const account of data.accounts) {
      const accountTransactions = data.transactions.filter(t => t.accountId === account.id);

      ofxContent += `<STMTRS>
<CURDEF>${account.currency || 'GBP'}
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>${account.id}
<ACCTTYPE>${this.mapOFXAccountType(account.type)}
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${now}
<DTEND>${now}
`;

      for (const transaction of accountTransactions) {
        const date = new Date(transaction.date).toISOString().replace(/[-:]/g, '').split('.')[0];
        // Amounts are stored signed (expenses negative), so emit as-is — no per-type '-' prefix
        const amount = `${transaction.amount}`;

        ofxContent += `<STMTTRN>
<TRNTYPE>${transaction.type === 'expense' ? 'DEBIT' : 'CREDIT'}
<DTPOSTED>${date}
<TRNAMT>${amount}
<FITID>${transaction.id}
<NAME>${transaction.description || ''}
<MEMO>${transaction.notes || ''}
</STMTTRN>
`;
      }

      ofxContent += `</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${account.balance}
<DTASOF>${now}
</LEDGERBAL>
</STMTRS>
`;
    }

    ofxContent += `</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    return ofxContent;
  }

  // Helper method to map account types to QIF format
  private mapAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      'current': 'Bank',
      'checking': 'Bank',
      'savings': 'Bank',
      'credit': 'CCard',
      'loan': 'Liability',
      'investment': 'Investment',
      'other': 'Bank'
    };
    return typeMap[type] || 'Bank';
  }

  // Helper method to map account types to OFX format
  private mapOFXAccountType(type: string): string {
    const typeMap: Record<string, string> = {
      'current': 'CHECKING',
      'checking': 'CHECKING',
      'savings': 'SAVINGS',
      'credit': 'CREDITLINE',
      'loan': 'LOAN',
      'investment': 'INVESTMENT',
      'other': 'CHECKING'
    };
    return typeMap[type] || 'CHECKING';
  }
}

/**
 * Templates travel with the account.
 *
 * A saved export ("Monthly Summary, CSV, transactions only") is a statement
 * about how this user reports on their own money, not about the browser they
 * built it in — and until now it existed on exactly one machine and was absent
 * from every backup. The store is the preferences document; the VALUES are the
 * same JSON they always were, so an existing browser's templates are read back
 * unchanged and then follow the user from there.
 */
export const exportService = new ExportService({ storage: preferences });
