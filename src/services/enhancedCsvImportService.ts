import type { Transaction, Account, Category } from '../types';
import { smartCategorizationService } from './smartCategorizationService';
import { importRulesService } from './importRulesService';
import type { JsonValue } from '../types/common';
import { toDecimal, toNumber } from '../utils/decimal';
import { signTransactionAmount } from '../utils/transactionAmount';
import { tokenizeCsv, type CsvRecord } from '../utils/csvTokenizer';
import { detectHeaderRecord, recordIndexAtLine } from '../utils/csvHeaderDetection';
import {
  CSV_DATE_FORMATS,
  parseCsvDateCell,
  SUGGESTED_AMBIGUOUS_FORMAT,
  type CsvDateFormat,
  type CsvDateFormatChoice,
  type DateFormatSample
} from '../utils/csvDateFormat';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Column-name keywords marking the money-out / money-in halves of two-column
// bank formats. Matched as substrings of the lowercased source column name,
// so 'withdrawal' also covers 'Withdrawals' / 'WITHDRAWALS' / 'Withdrawal
// Amount'. 'Dare'/'Avere' are the Italian debit/credit column names
// (intesa-sanpaolo profile).
const OUTFLOW_COLUMN_KEYWORDS = ['debit', 'paid out', 'money out', 'withdrawal', 'dare'];
const INFLOW_COLUMN_KEYWORDS = ['credit', 'paid in', 'money in', 'deposit', 'avere'];

/**
 * How many of a file's opening records the heading-row picker offers.
 *
 * A bank's covering block is a handful of lines; ten is generous for one and
 * short enough to read at a glance. It matches the window the detector itself
 * searches, so the picker can always show the line the detector chose.
 */
const HEADING_CANDIDATE_RECORDS = 10;

/**
 * What one CSV row came to: a transaction, or a refusal that says why.
 *
 * The reason is prose meant for the person holding the file — it is printed in
 * the preview against the row it belongs to and listed by row number at the end
 * of an import.
 */
export type RowBuildResult =
  | { ok: true; transaction: Partial<Transaction> }
  | { ok: false; error: string };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type Logger = Pick<Console, 'warn' | 'error'>;

type CategorizationServiceLike = Pick<typeof smartCategorizationService, 'learnFromTransactions' | 'suggestCategories'>;

type ImportRulesServiceLike = Pick<typeof importRulesService, 'applyRules'>;

export interface EnhancedCsvImportServiceOptions {
  storage?: StorageLike | null;
  logger?: Logger;
  now?: () => number;
  categorizationService?: CategorizationServiceLike;
  rulesService?: ImportRulesServiceLike;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: string) => JsonValue;
}

/**
 * A set of column choices somebody saved, to use again next month.
 *
 * ── THERE IS NO `type` ANY MORE ─────────────────────────────────────────────
 * This carried `type: 'transaction' | 'account'`, and the account half was
 * never implemented: the wizard's account branch was a `// TODO` that wrote
 * nothing, and latterly a refusal that said so out loud. A saved profile
 * marked 'account' could therefore never have imported anything — it was a
 * record of a decision the app never honoured. See {@link loadProfiles} for
 * what happens to one now.
 */
export interface ImportProfile {
  id: string;
  name: string;
  mappings: ColumnMapping[];
  /**
   * Which way round the file's dates are, saved WITH the columns because it is
   * the same decision: the bank that writes 'Paid out' also writes 01/06/2026,
   * and remembering the columns while forgetting the format is remembering the
   * easy half. 'auto' is a stored answer too — it means "this file proves its
   * own format", which is worth knowing next month.
   */
  dateFormat?: CsvDateFormatChoice;
  bank?: string;
  lastUsed?: Date;
  /**
   * The duplicate settings the file was imported with.
   *
   * Saved WITH the mappings because they are part of the same decision: a
   * credit-card export re-downloaded monthly overlaps its predecessor and wants
   * duplicate skipping on, while a file of opening balances wants it off. A
   * profile that restored only the columns silently restored half of what the
   * user set up, and the half it dropped is the half that decides whether rows
   * are written twice.
   */
  skipDuplicates?: boolean;
  duplicateThreshold?: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: number; // 0-100
  matches: Array<{
    id: string;
    field: string;
    similarity: number;
  }>;
}

export interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  items: Array<Partial<Transaction> | Partial<Account>>;
  errors: Array<{
    /**
     * The PHYSICAL line of the file the refused row starts on — the number the
     * user will see in a text editor.
     *
     * It used to be `rowIndex + 2`, an arithmetic guess that a row is a line
     * and a header is one line long. Both are false the moment a quoted field
     * contains a newline, and once one row spans three lines every number
     * after it is wrong by the same growing amount. The tokenizer counts real
     * lines and hands each record the one it started on.
     */
    line: number;
    error: string;
  }>;
}

/**
 * A CSV file, read.
 *
 * `headers`/`data` are the shape every caller already used. The other four are
 * the facts that used to be assumed and were sometimes wrong: which physical
 * line each row starts on, where the headings actually were, what was above
 * them, and whether the file is well formed at all.
 */
export interface ParsedCsv {
  headers: string[];
  /** The data rows, header row excluded. */
  data: string[][];
  /** `lines[i]` is the physical file line `data[i]` starts on. Same length as `data`. */
  lines: number[];
  /** The physical line the heading row was read from. */
  headerLine: number;
  /**
   * The records above the heading row — a bank's covering block.
   *
   * Handed back rather than dropped so the mapping step can print them greyed:
   * a parser that silently skips three lines of somebody's file is indist-
   * inguishable from one that has misread it.
   */
  preamble: CsvRecord[];
  /**
   * The file's opening records, whichever one is currently the heading row.
   *
   * The mini-preview offers these as the lines the headings could be on, so the
   * user can move the choice in either direction — including back UP, when
   * detection has skipped a line that was really data. A picker that could only
   * show what had already been skipped could not undo an over-eager detection.
   */
  headingCandidates: CsvRecord[];
  /** Why the heading row was taken from where it was, when it was not line 1. */
  headerDetectedBecause: string | null;
  /**
   * The line a quote was opened on and never closed.
   *
   * Not a warning: everything after it has been swallowed into one cell, so the
   * rows below are missing rather than wrong. The caller refuses the file.
   */
  unterminatedQuoteLine: number | null;
}

/**
 * A bank's export format, as one thing.
 *
 * ── WHY THE LABEL LIVES HERE AND NOT IN THE BUTTON ──────────────────────────
 * The template list used to be a hand-typed array of bank NAMES in the
 * component, looked up against a map of ids in this service by
 * `name.toLowerCase()`. Twenty of the forty-one names on screen matched no id
 * at all — 'MBNA', 'Bank of America', 'Amex', 'Chase UK', 'Metro Bank' — so
 * pressing them returned `[]`: an empty mapping, presented as a configured one.
 * The user got a Column Mapping step with nothing in it and no way to know the
 * button had done nothing. Meanwhile forty-three formats that DO exist here
 * (Wells Fargo, TD, Mint, the Italian and French banks) were reachable from no
 * button at all.
 *
 * One list, carrying its own label, cannot drift like that: what is offered is
 * what exists, because it is the same object.
 */
export interface BankTemplate {
  /** Stable key. `getBankMappings` takes this, and profiles record it. */
  id: string;
  /** What the user is shown. */
  label: string;
  /** Which heading it appears under. */
  region: BankTemplateRegion;
  /**
   * What this format's columns are called. Shown to the user next to the label,
   * so they can compare it with the file in front of them BEFORE trusting it —
   * a bank can change its export at any time and this app will not have heard.
   */
  mappings: ColumnMapping[];
  /**
   * Which way round this bank writes its dates.
   *
   * A bank knows its own format: a UK high-street export is DD/MM, an American
   * one is MM/DD, and an app exporter (Monzo, Starling, Wise, the exchanges)
   * ships ISO. Carrying it here means picking your bank answers the question
   * that a file of nothing but early-month dates cannot answer for itself.
   *
   * EVERY template declares one, and a test holds that. Undefined would mean
   * "we did not think about this bank", which is exactly the state a prefill
   * must never be in — and the value is a PREFILL of the control, so a bank
   * that has since changed is corrected in one click rather than argued with.
   */
  dateFormat: CsvDateFormat;
}

export type BankTemplateRegion =
  | 'UK'
  | 'Europe'
  | 'North America'
  | 'Asia-Pacific'
  | 'Payments'
  | 'Crypto'
  | 'Investments'
  | 'Accounting apps';

/**
 * The order the regions are shown in. Declared rather than derived so the list
 * does not reshuffle when a template is added.
 */
export const BANK_TEMPLATE_REGIONS: readonly BankTemplateRegion[] = [
  'UK',
  'Europe',
  'North America',
  'Asia-Pacific',
  'Payments',
  'Crypto',
  'Investments',
  'Accounting apps'
];

/**
 * The shipped formats.
 *
 * EVERY MAPPING HERE IS A GUESS ABOUT SOMEBODY ELSE'S PRODUCT, and banks change
 * their exports without telling anyone. That is why a template is a PREFILL and
 * never a promise: the mapping step matches these column names against the
 * file's real headers and says, per column, which ones were found. A template
 * whose bank has since renamed a column degrades to "not found in your file"
 * instead of importing the wrong column or silently importing nothing.
 *
 * Where two formats of the same bank exist, both are listed and the label says
 * what distinguishes them — one entry silently shadowing the other is how a
 * user concludes the feature is broken.
 *
 * The same caveat covers `dateFormat`, and it is the one that matters most: a
 * template that names the wrong way round would transpose the first twelve days
 * of every month. It is therefore a PREFILL of a control the user can see and
 * change, sitting next to a preview that prints the file's own date string
 * beside the parsed one — and where the FILE proves a different format (a 13th
 * anywhere in the column), the mapping step says so rather than letting the
 * template win by default.
 */
const BANK_TEMPLATES: readonly BankTemplate[] = [
  // ── UK ────────────────────────────────────────────────────────────────────
  {
    id: 'barclays',
    label: 'Barclays',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Subcategory', targetField: 'category' },
      // Barclays' own export calls the payee column 'Memo'. Listed alongside
      // 'Description' because both have shipped; whichever the file has wins,
      // and the other is reported as not found rather than left to confuse.
      { sourceColumn: 'Memo', targetField: 'description' }
    ]
  },
  {
    id: 'hsbc',
    label: 'HSBC UK',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ]
  },
  {
    id: 'lloyds',
    label: 'Lloyds Bank',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Transaction Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'natwest',
    label: 'NatWest',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Type', targetField: 'category' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Value', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'santander',
    label: 'Santander UK',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'halifax',
    label: 'Halifax',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Transaction Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'rbs',
    label: 'Royal Bank of Scotland',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Type', targetField: 'category' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Value', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'tsb',
    label: 'TSB',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Transaction Type', targetField: 'category' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Paid In', targetField: 'amount' },
      { sourceColumn: 'Paid Out', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'first-direct',
    label: 'first direct',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'co-op',
    label: 'The Co-operative Bank',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Narrative', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'virgin',
    label: 'Virgin Money',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debits', targetField: 'amount' },
      { sourceColumn: 'Credits', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'tesco',
    label: 'Tesco Bank',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Money Out', targetField: 'amount' },
      { sourceColumn: 'Money In', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'metro',
    label: 'Metro Bank',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Transaction', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'nationwide',
    label: 'Nationwide Building Society',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Transaction type', targetField: 'category' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Paid out', targetField: 'amount' },
      { sourceColumn: 'Paid in', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'yorkshire',
    label: 'Yorkshire Building Society',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'coventry',
    label: 'Coventry Building Society',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'skipton',
    label: 'Skipton Building Society',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Transaction Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'monzo',
    label: 'Monzo',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      // Monzo ships both: 'Name' is the payee, 'Description' the raw bank
      // narrative. Name is listed second so it wins where both are present.
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Name', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Category', targetField: 'category' },
      { sourceColumn: 'Notes and #tags', targetField: 'notes' }
    ]
  },
  {
    id: 'starling',
    label: 'Starling Bank',
    region: 'UK',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Counter Party', targetField: 'description' },
      { sourceColumn: 'Reference', targetField: 'notes' },
      { sourceColumn: 'Type', targetField: 'category' },
      { sourceColumn: 'Amount (GBP)', targetField: 'amount' },
      { sourceColumn: 'Balance (GBP)', targetField: 'balance' }
    ]
  },
  {
    id: 'revolut',
    label: 'Revolut',
    region: 'UK',
    dateFormat: 'YYYY-MM-DD',
    mappings: [
      { sourceColumn: 'Started Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Category', targetField: 'category' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },

  // ── Europe ────────────────────────────────────────────────────────────────
  {
    id: 'deutsche-bank',
    label: 'Deutsche Bank',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Booking date', targetField: 'date' },
      { sourceColumn: 'Transaction Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'bnp-paribas',
    label: 'BNP Paribas',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Label', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'credit-agricole',
    label: 'Crédit Agricole',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date Operation', targetField: 'date' },
      { sourceColumn: 'Libelle', targetField: 'description' },
      { sourceColumn: 'Montant', targetField: 'amount' },
      { sourceColumn: 'Solde', targetField: 'balance' }
    ]
  },
  {
    id: 'societe-generale',
    label: 'Société Générale',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Libelle', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Solde', targetField: 'balance' }
    ]
  },
  {
    id: 'ing',
    label: 'ING (Debit/Credit columns)',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance after transaction', targetField: 'balance' }
    ]
  },
  {
    id: 'ing-bank',
    label: 'ING (single Amount column)',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'abn-amro',
    label: 'ABN AMRO',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'rabobank',
    label: 'Rabobank',
    region: 'Europe',
    dateFormat: 'YYYY-MM-DD',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'unicredit',
    label: 'UniCredit',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Data', targetField: 'date' },
      { sourceColumn: 'Descrizione', targetField: 'description' },
      { sourceColumn: 'Importo', targetField: 'amount' },
      { sourceColumn: 'Saldo', targetField: 'balance' }
    ]
  },
  {
    id: 'intesa-sanpaolo',
    label: 'Intesa Sanpaolo',
    region: 'Europe',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Data', targetField: 'date' },
      { sourceColumn: 'Causale', targetField: 'description' },
      { sourceColumn: 'Dare', targetField: 'amount' },
      { sourceColumn: 'Avere', targetField: 'amount' },
      { sourceColumn: 'Saldo', targetField: 'balance' }
    ]
  },

  // ── North America ─────────────────────────────────────────────────────────
  {
    id: 'chase',
    label: 'Chase (credit card export)',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Type', targetField: 'category' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'chase-checking',
    label: 'Chase (checking export)',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      // The checking export dates its rows 'Posting Date', not 'Transaction
      // Date' — the credit-card template above matches nothing on it, which is
      // exactly the sort of near-miss the mapping step now names out loud.
      { sourceColumn: 'Posting Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'bank-of-america',
    label: 'Bank of America',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Running Bal.', targetField: 'balance' }
    ]
  },
  {
    id: 'wells-fargo',
    label: 'Wells Fargo',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Deposits', targetField: 'amount' },
      { sourceColumn: 'Withdrawals', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'citibank',
    label: 'Citi',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'td-bank',
    label: 'TD Bank (US)',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'DATE', targetField: 'date' },
      { sourceColumn: 'DESCRIPTION', targetField: 'description' },
      { sourceColumn: 'WITHDRAWALS', targetField: 'amount' },
      { sourceColumn: 'DEPOSITS', targetField: 'amount' },
      { sourceColumn: 'BALANCE', targetField: 'balance' }
    ]
  },
  {
    id: 'rbc-royal-bank',
    label: 'RBC Royal Bank',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Description 1', targetField: 'description' },
      { sourceColumn: 'CAD$', targetField: 'amount' },
      { sourceColumn: 'USD$', targetField: 'amount' }
    ]
  },
  {
    id: 'td-canada-trust',
    label: 'TD Canada Trust',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'scotiabank',
    label: 'Scotiabank',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Withdrawals', targetField: 'amount' },
      { sourceColumn: 'Deposits', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'bmo-bank-of-montreal',
    label: 'BMO Bank of Montreal',
    region: 'North America',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Withdrawal', targetField: 'amount' },
      { sourceColumn: 'Deposit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },

  // ── Asia-Pacific ──────────────────────────────────────────────────────────
  {
    id: 'dbs-bank',
    label: 'DBS Bank',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Transaction Description', targetField: 'description' },
      { sourceColumn: 'Withdrawal', targetField: 'amount' },
      { sourceColumn: 'Deposit', targetField: 'amount' },
      { sourceColumn: 'Available Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'ocbc-bank',
    label: 'OCBC Bank',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Withdrawal Amount', targetField: 'amount' },
      { sourceColumn: 'Deposit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'uob-bank',
    label: 'UOB',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'icbc',
    label: 'ICBC',
    region: 'Asia-Pacific',
    dateFormat: 'YYYY-MM-DD',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'hsbc-asia',
    label: 'HSBC (Asia)',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Transaction Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'anz',
    label: 'ANZ (Transaction Date column)',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'anz-bank',
    label: 'ANZ (Date column)',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'commonwealth',
    label: 'Commonwealth Bank (Debit/Credit columns)',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'commonwealth-bank',
    label: 'Commonwealth Bank (Debit Amount/Credit Amount columns)',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'westpac',
    label: 'Westpac',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Narrative', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'nab',
    label: 'NAB (Transaction Details column)',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Transaction Details', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'nab-bank',
    label: 'NAB (Description column)',
    region: 'Asia-Pacific',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit', targetField: 'amount' },
      { sourceColumn: 'Credit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  {
    id: 'paypal',
    label: 'PayPal',
    region: 'Payments',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Name', targetField: 'description' },
      { sourceColumn: 'Gross', targetField: 'amount' },
      { sourceColumn: 'Type', targetField: 'category' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'wise',
    label: 'Wise',
    region: 'Payments',
    dateFormat: 'DD/MM/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Currency', targetField: 'currency' },
      { sourceColumn: 'Running Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'stripe',
    label: 'Stripe',
    region: 'Payments',
    dateFormat: 'YYYY-MM-DD',
    mappings: [
      { sourceColumn: 'Created (UTC)', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Currency', targetField: 'currency' },
      { sourceColumn: 'Available Balance', targetField: 'balance' }
    ]
  },

  // ── Crypto ────────────────────────────────────────────────────────────────
  {
    id: 'coinbase',
    label: 'Coinbase',
    region: 'Crypto',
    dateFormat: 'YYYY-MM-DD',
    mappings: [
      { sourceColumn: 'Timestamp', targetField: 'date' },
      { sourceColumn: 'Transaction Type', targetField: 'description' },
      { sourceColumn: 'Asset', targetField: 'category' },
      { sourceColumn: 'Quantity Transacted', targetField: 'amount' },
      { sourceColumn: 'Spot Price Currency', targetField: 'currency' }
    ]
  },
  {
    id: 'binance',
    label: 'Binance',
    region: 'Crypto',
    dateFormat: 'YYYY-MM-DD',
    mappings: [
      { sourceColumn: 'Date(UTC)', targetField: 'date' },
      { sourceColumn: 'Market', targetField: 'description' },
      { sourceColumn: 'Type', targetField: 'category' },
      { sourceColumn: 'Price', targetField: 'amount' },
      { sourceColumn: 'Amount', targetField: 'quantity' }
    ]
  },
  {
    id: 'kraken',
    label: 'Kraken',
    region: 'Crypto',
    dateFormat: 'YYYY-MM-DD',
    mappings: [
      { sourceColumn: 'time', targetField: 'date' },
      { sourceColumn: 'type', targetField: 'description' },
      { sourceColumn: 'asset', targetField: 'category' },
      { sourceColumn: 'amount', targetField: 'amount' },
      { sourceColumn: 'balance', targetField: 'balance' }
    ]
  },

  // ── Investments ───────────────────────────────────────────────────────────
  {
    id: 'vanguard',
    label: 'Vanguard',
    region: 'Investments',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Trade Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Investment Name', targetField: 'category' },
      { sourceColumn: 'Share Price', targetField: 'price' },
      { sourceColumn: 'Shares', targetField: 'quantity' },
      { sourceColumn: 'Principal Amount', targetField: 'amount' }
    ]
  },
  {
    id: 'fidelity',
    label: 'Fidelity',
    region: 'Investments',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Run Date', targetField: 'date' },
      { sourceColumn: 'Action', targetField: 'description' },
      { sourceColumn: 'Symbol', targetField: 'category' },
      { sourceColumn: 'Price', targetField: 'price' },
      { sourceColumn: 'Quantity', targetField: 'quantity' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ]
  },
  {
    id: 'charles-schwab',
    label: 'Charles Schwab',
    region: 'Investments',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Action', targetField: 'description' },
      { sourceColumn: 'Symbol', targetField: 'category' },
      { sourceColumn: 'Price', targetField: 'price' },
      { sourceColumn: 'Quantity', targetField: 'quantity' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ]
  },
  {
    id: 'etrade',
    label: 'E*TRADE',
    region: 'Investments',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'TransactionDate', targetField: 'date' },
      { sourceColumn: 'TransactionType', targetField: 'description' },
      { sourceColumn: 'Symbol', targetField: 'category' },
      { sourceColumn: 'Quantity', targetField: 'quantity' },
      { sourceColumn: 'Price', targetField: 'price' },
      { sourceColumn: 'Amount', targetField: 'amount' }
    ]
  },

  // ── Accounting apps ───────────────────────────────────────────────────────
  {
    id: 'quickbooks',
    label: 'QuickBooks',
    region: 'Accounting apps',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  },
  {
    id: 'mint',
    label: 'Mint',
    region: 'Accounting apps',
    dateFormat: 'MM/DD/YYYY',
    mappings: [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Transaction Type', targetField: 'type' },
      { sourceColumn: 'Category', targetField: 'category' }
    ]
  },
  {
    id: 'wave',
    label: 'Wave',
    region: 'Accounting apps',
    dateFormat: 'YYYY-MM-DD',
    mappings: [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Withdrawal', targetField: 'amount' },
      { sourceColumn: 'Deposit', targetField: 'amount' },
      { sourceColumn: 'Balance', targetField: 'balance' }
    ]
  }
];

/**
 * The target fields a CSV import can actually WRITE onto a transaction.
 *
 * Anything else a template names — a running 'balance', a share 'price', a
 * 'quantity', a 'currency' — is carried no further than the parse: the wizard
 * builds its drafts from these fields and no others. Offering those as choices,
 * or applying them from a template without saying so, is a control that does
 * nothing. They are now filtered out where a template is applied, and NAMED
 * where the user can see them.
 */
export const IMPORTABLE_TRANSACTION_FIELDS: readonly string[] = [
  'date',
  'description',
  'amount',
  'category',
  'accountName',
  'type',
  'tags',
  'notes'
];

/**
 * The three a file cannot be imported without.
 *
 * Not a house style rule — each one is a corruption if it is missing. No date
 * mapping and every row arrives with an unreadable date; no amount mapping and
 * every row arrives at zero, which reconciles against nothing; no description
 * and the register fills with blank payees nobody can identify later.
 * 'amount' is satisfied by a single signed column OR by a debit/credit pair,
 * because both map to the same target.
 */
export const REQUIRED_TRANSACTION_FIELDS: readonly string[] = ['date', 'description', 'amount'];

/**
 * A profile as it comes BACK from storage, where a Date has been through JSON
 * and is a string again, and where a field this app has since dropped may still
 * be present. Kept separate from {@link ImportProfile} so the difference is
 * stated rather than assumed away.
 */
type StoredProfile = Omit<ImportProfile, 'lastUsed' | 'dateFormat'> & {
  lastUsed?: string | number | Date;
  /** Unvalidated: storage is not a type system, so this is narrowed on load. */
  dateFormat?: unknown;
  /** Written by versions that offered an account import. See isDeadAccountProfile. */
  type?: unknown;
};

const isColumnMapping = (value: unknown): value is ColumnMapping => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate: Record<string, unknown> = { ...value };
  return typeof candidate.sourceColumn === 'string' && typeof candidate.targetField === 'string';
};

/** Is this thing out of storage actually a profile? Checked, not assumed. */
const isImportProfile = (value: unknown): value is StoredProfile => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate: Record<string, unknown> = { ...value };
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return false;
  // `type` is NOT required any more, and must not be: profiles written before
  // it was dropped still have it, and profiles written after it never will.
  // Requiring either shape would throw away half the user's saved work on the
  // release that changed it.
  return Array.isArray(candidate.mappings) && candidate.mappings.every(isColumnMapping);
};

/**
 * Was this stored profile for the account import that never existed?
 *
 * The wizard's account branch wrote nothing — first a `// TODO`, later a
 * refusal that said so. Its mappings point at `name`, `balance`, `institution`:
 * fields no transaction has. So one of these is not a profile that has stopped
 * working; it is a profile that never worked.
 */
const isDeadAccountProfile = (value: StoredProfile): boolean => {
  const candidate: Record<string, unknown> = { ...value };
  return candidate.type === 'account';
};

/** A stored dateFormat is only honoured if it is one this app actually has. */
const isStoredDateFormat = (value: unknown): value is CsvDateFormatChoice =>
  value === 'auto' || CSV_DATE_FORMATS.some(format => format === value);

const toDate = (value: string | number | Date): Date =>
  value instanceof Date ? value : new Date(value);

export class EnhancedCsvImportService {
  private profiles: ImportProfile[] = [];
  private readonly storage: StorageLike | null;
  private readonly logger: Logger;
  private readonly nowProvider: () => number;
  private readonly categorizationService: CategorizationServiceLike;
  private readonly rulesService: ImportRulesServiceLike;
  private idCounter = 0;
  /** Names of dead account profiles dropped on load; see consumeDiscardedProfileNotice. */
  private discardedProfileNames: string[] = [];

  constructor(options: EnhancedCsvImportServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => Date.now());
    this.categorizationService = options.categorizationService ?? smartCategorizationService;
    this.rulesService = options.rulesService ?? importRulesService;
    this.profiles = this.loadProfiles();
  }

  // `createDate` and `getCurrentDateString` used to live here. They existed for
  // ONE caller: the date parser's fallback, which put TODAY on a row whose date
  // cell it could not read. That fallback is gone — a statement line silently
  // redated to today reconciles against nothing and is not where anybody will
  // look for it — and with it the only reason this service ever needed to know
  // what day it is. `nowProvider` remains for the deterministic import ids.

  private createId(prefix: string, index: number): string {
    return `${prefix}-${this.nowProvider()}-${index}-${this.idCounter++}`;
  }

  /**
   * Read a CSV file into its heading row and its data rows.
   *
   * ── THE SPLIT-ON-NEWLINE PARSER IS GONE ─────────────────────────────────────
   * This used to cut the file on '\n' and only then look for quotes, which
   * loses a transaction every time a description contains a line break — a
   * quoted multi-line memo became two half-rows, both then reported as
   * unreadable, with the amount that WAS in the file simply absent. Tokenizing
   * is the only way round that, and it is also what makes the line numbers in
   * every refusal mean physical lines rather than an index plus two.
   *
   * ── AND THE HEADINGS ARE NOT ASSUMED TO BE ON LINE 1 ────────────────────────
   * Plenty of banks put a covering block above the table. `headerLine` lets the
   * caller say where the headings really are; left out, they are detected (see
   * csvHeaderDetection) and the lines above them are handed back as `preamble`
   * so the user can see what is being ignored and move the choice.
   */
  parseCSV(content: string, options: { headerLine?: number } = {}): ParsedCsv {
    const { records, unterminatedQuoteLine } = tokenizeCsv(content);

    if (records.length === 0) {
      return {
        headers: [],
        data: [],
        lines: [],
        headerLine: 1,
        preamble: [],
        headingCandidates: [],
        headerDetectedBecause: null,
        unterminatedQuoteLine
      };
    }

    const detected = detectHeaderRecord(records);
    const chosenIndex =
      options.headerLine === undefined
        ? detected.recordIndex
        : // A line the user pointed at that holds no record is not honoured
          // silently: the detection stands, and the mini-preview goes on
          // showing which line IS being used.
          recordIndexAtLine(records, options.headerLine) ?? detected.recordIndex;

    const headerRecord = records[chosenIndex];
    const dataRecords = records.slice(chosenIndex + 1);

    return {
      headers: headerRecord.cells,
      data: dataRecords.map(record => record.cells),
      lines: dataRecords.map(record => record.line),
      headerLine: headerRecord.line,
      preamble: records.slice(0, chosenIndex),
      headingCandidates: records.slice(0, Math.max(HEADING_CANDIDATE_RECORDS, chosenIndex + 1)),
      headerDetectedBecause: options.headerLine === undefined ? detected.because : null,
      unterminatedQuoteLine
    };
  }

  /**
   * The date column's cells, each with the file line it sits on, for working
   * out which way round the file writes its dates.
   *
   * Lives here rather than in the wizard because resolving a mapping to a
   * column index is this service's job, and a second implementation of it in
   * the component is a second thing to get wrong.
   */
  dateColumnSamples(
    headers: string[],
    rows: string[][],
    mappings: ColumnMapping[],
    lines: number[]
  ): DateFormatSample[] {
    const mapping = mappings.find(entry => entry.targetField === 'date');
    if (!mapping) return [];
    const index = headers.indexOf(mapping.sourceColumn);
    if (index < 0) return [];
    return rows.map((row, rowIndex) => ({
      value: row[index] ?? '',
      line: lines[rowIndex] ?? rowIndex + 2
    }));
  }

  /**
   * Smart column mapping using fuzzy matching.
   *
   * Transactions only. It used to branch on a `type` argument and, in the
   * 'account' half, suggest name/balance/type columns for an account import
   * that never existed — the wizard's account branch wrote nothing at all. A
   * suggestion for a thing that cannot happen is the same dead control as a
   * button that does nothing.
   */
  suggestMappings(headers: string[]): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    /**
     * ── ONE COLUMN, ONE MEANING ────────────────────────────────────────────
     * Every column claimed so far, so nothing can be claimed twice.
     *
     * "Amount" and "account" are two edits apart, which scores 0.71 on the
     * fuzzy match — over the 0.6 threshold. So on the commonest CSV shape there
     * is, Date/Description/Amount with no account column at all, the Amount
     * column was mapped to `amount` AND to `accountName`. Every row then
     * arrived naming an account called "-4.20", every row was unroutable, and
     * the import finished with "3 transactions had no account to go into —
     * their Account column names -4.20, -52.40, 1200.00". A plain three-column
     * export imported NOTHING, and told the user to go and rename an account.
     *
     * The amount search already excluded the date and payee columns for exactly
     * this reason ("Deposit Date" holds a date, not money). The rule was right;
     * it was only applied to one of the four searches.
     */
    const claimed = new Set<number>();

    // Date mapping.
    //
    // NO TRANSFORM. It used to carry `value => this.parseDate(value)`, a
    // closure that defaulted an unreadable cell to TODAY because its return
    // type had no way to say "no". The row builder has always ignored it and
    // resolved the raw cell itself so a failure could be reported as one; the
    // closure survived as a loaded gun pointed at any future caller that
    // trusted it. Now the date column is read in exactly one place, under a
    // format the user can see.
    const datePatterns = ['date', 'transaction date', 'posted', 'trans date', 'value date'];
    const dateIndex = this.findBestMatch(normalizedHeaders, datePatterns, claimed);
    if (dateIndex >= 0) {
      claimed.add(dateIndex);
      mappings.push({
        sourceColumn: headers[dateIndex],
        targetField: 'date'
      });
    }

    // Description mapping
    const descPatterns = ['description', 'desc', 'memo', 'details', 'transaction', 'merchant', 'payee', 'narrative'];
    const descIndex = this.findBestMatch(normalizedHeaders, descPatterns, claimed);
    if (descIndex >= 0) {
      claimed.add(descIndex);
      mappings.push({
        sourceColumn: headers[descIndex],
        targetField: 'description'
      });
    }

    // THE INDICATOR COLUMN, before the amount hunt: a name saying both
    // debit AND credit ("Debit or Credit", "Debit/Credit") holds DBIT/CRDT
    // cells that give an unsigned amount its direction. It is suggested as
    // the TYPE — the row builder signs the magnitude from it — and claimed,
    // so the amount hunt below cannot mistake it for money (which is how
    // the owner's card statement died row by row, 28 Aug).
    const indicatorIndex = headers.findIndex((header, index) => {
      if (claimed.has(index)) return false;
      const name = header.toLowerCase();
      return OUTFLOW_COLUMN_KEYWORDS.some(k => name.includes(k)) &&
        INFLOW_COLUMN_KEYWORDS.some(k => name.includes(k));
    });
    if (indicatorIndex >= 0) {
      claimed.add(indicatorIndex);
      mappings.push({
        sourceColumn: headers[indicatorIndex],
        targetField: 'type'
      });
    }

    // Amount mapping.
    //
    // BOTH HALVES OF A TWO-COLUMN FORMAT, NOT THE BETTER-SPELT ONE. Most UK
    // banks ship money-out and money-in as separate columns. The old
    // single-best-match picked whichever of "Paid out" / "Paid in" scored
    // higher and dropped the other, so on a Lloyds or Nationwide statement
    // every credit row — wages, refunds, transfers in — came through with no
    // usable amount and was skipped. The same keywords the row builder uses
    // to classify a column are used to find them, so detection and
    // interpretation cannot disagree.
    const directionalIndices = headers
      .map((header, index) => ({ header, index }))
      // A column already claimed as the date or the payee is not an amount,
      // however it is spelt — "Deposit Date" holds a date, and reading it as
      // money would put an unparseable figure on the row.
      .filter(({ index }) => !claimed.has(index))
      .filter(({ header }) => this.classifyAmountColumn(header) !== 'signed')
      .map(({ index }) => index);

    if (directionalIndices.length > 0) {
      for (const index of directionalIndices) {
        claimed.add(index);
        mappings.push({
          sourceColumn: headers[index],
          targetField: 'amount',
          transform: (value: string) => this.parseAmount(value)
        });
      }
    } else {
      const amountPatterns = ['amount', 'value', 'charge'];
      const amountIndex = this.findBestMatch(normalizedHeaders, amountPatterns, claimed);
      if (amountIndex >= 0) {
        claimed.add(amountIndex);
        mappings.push({
          sourceColumn: headers[amountIndex],
          targetField: 'amount',
          transform: (value: string) => this.parseAmount(value)
        });
      }
    }

    // Category mapping
    const categoryPatterns = ['category', 'cat', 'type', 'classification'];
    const categoryIndex = this.findBestMatch(normalizedHeaders, categoryPatterns, claimed);
    if (categoryIndex >= 0) {
      claimed.add(categoryIndex);
      mappings.push({
        sourceColumn: headers[categoryIndex],
        targetField: 'category'
      });
    }

    // Account mapping
    const accountPatterns = ['account', 'acc', 'account name', 'from account'];
    const accountIndex = this.findBestMatch(normalizedHeaders, accountPatterns, claimed);
    if (accountIndex >= 0) {
      claimed.add(accountIndex);
      mappings.push({
        sourceColumn: headers[accountIndex],
        targetField: 'accountName'
      });
    }

    return mappings;
  }

  /**
   * Find best matching header using fuzzy search, skipping columns another
   * field has already claimed.
   */
  private findBestMatch(
    headers: string[],
    patterns: string[],
    claimed: ReadonlySet<number> = new Set()
  ): number {
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < headers.length; i++) {
      if (claimed.has(i)) continue;
      const header = headers[i];
      for (const pattern of patterns) {
        const score = this.calculateSimilarity(header, pattern.toLowerCase());
        if (score > bestScore && score > 0.6) { // 60% similarity threshold
          bestScore = score;
          bestIndex = i;
        }
      }
    }
    
    return bestIndex;
  }

  /**
   * Calculate string similarity (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    // An exact match outranks any containment — "Description" must beat a
    // column that merely CONTAINS a synonym, whatever order they arrive in.
    if (str1 === str2) return 1.0;

    // CONTAINMENT AS A WHOLE WORD IS A MATCH, whatever the edit distance
    // says: "Billing Amount" IS an amount column, but fourteen characters
    // against six scored 0.43 and lost to the 0.6 bar — so the owner's card
    // statement suggested no amount at all and every column needed mapping
    // by hand (28 Aug). Word-bounded, so "category" does not contain "cat".
    if (shorter.length >= 3) {
      const boundary = new RegExp(`(^|[^a-z0-9])${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
      if (boundary.test(longer)) return 0.9;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Parse amount with currency symbol handling
   */
  private parseAmount(value: string): number {
    // Remove currency symbols and spaces
    const cleaned = value.replace(/[£$€¥,\s]/g, '');

    // Handle parentheses for negative amounts
    const isNegative = cleaned.startsWith('(') || cleaned.startsWith('-');
    const amount = Math.abs(toNumber(toDecimal(cleaned.replace(/[()]/g, ''))));

    return isNegative ? -amount : amount;
  }

  /**
   * Classify an amount column by its source column name: money-out (debit),
   * money-in (credit), or a single SIGNED amount column.
   */
  private classifyAmountColumn(sourceColumn: string): 'outflow' | 'inflow' | 'signed' {
    const name = sourceColumn.toLowerCase();
    const looksOutflow = OUTFLOW_COLUMN_KEYWORDS.some(keyword => name.includes(keyword));
    const looksInflow = INFLOW_COLUMN_KEYWORDS.some(keyword => name.includes(keyword));
    // A name that says BOTH — "Debit or Credit", "Debit/Credit" — is an
    // INDICATOR column (DBIT/CRDT cells that give the amount its direction),
    // not an amount column of either orientation. Claiming it as one parsed
    // DBIT as money and killed every row of the owner's card statement.
    if (looksOutflow && looksInflow) return 'signed';
    if (looksOutflow) return 'outflow';
    if (looksInflow) return 'inflow';
    return 'signed';
  }

  /**
   * Normalize an explicit type-column cell (e.g. Mint's "Transaction Type")
   * to a transaction type. Returns null for unrecognized values so callers
   * fall back to sign-derived classification.
   */
  private normalizeTypeCell(value: string): Transaction['type'] | null {
    // 'dbit'/'crdt'/'dr'/'cr': the ISO-flavoured indicator vocabulary card
    // statements use — the owner's file says DBIT/CRDT (28 Aug), and DR/CR
    // appear in older UK exports. Exact matches only: a description column
    // mapped here by mistake stays unrecognized and falls back to the sign.
    switch (value.trim().toLowerCase()) {
      case 'debit':
      case 'dbit':
      case 'dr':
      case 'withdrawal':
      case 'expense':
        return 'expense';
      case 'credit':
      case 'crdt':
      case 'cr':
      case 'deposit':
      case 'income':
        return 'income';
      case 'transfer':
        return 'transfer';
      default:
        return null;
    }
  }

  /**
   * Build a transaction from a CSV row. Shared by importTransactions and
   * generatePreview so previews always match what gets written.
   *
   * Signed convention: expenses stored negative, income positive. The parsed
   * cell SIGN is authoritative — a positive debit cell is money out, but a
   * NEGATIVE debit cell is a reversal (money in), mirror-inverted for credit
   * cells. Returns { ok: false } when a debit/credit format yields no usable
   * amount (zero or empty cells), so the row is skipped instead of importing
   * an undefined amount.
   */
  private buildTransactionFromRow(
    row: string[],
    mappings: ColumnMapping[],
    columnIndices: Map<string, number>,
    dateFormat: CsvDateFormat
  ): RowBuildResult {
    const transaction: Partial<Transaction> = {
      type: 'expense', // Default
      cleared: false // Default
    };

    let outflowCell: number | null = null;
    let inflowCell: number | null = null;
    let explicitType: Transaction['type'] | null = null;
    let hasDirectionalAmountColumn = false;
    /** The date cell the file offered, so a refusal can quote it back. */
    let dateCell: string | null = null;
    let hasDateMapping = false;

    for (const mapping of mappings) {
      const columnKind = mapping.targetField === 'amount'
        ? this.classifyAmountColumn(mapping.sourceColumn)
        : 'signed';
      if (mapping.targetField === 'amount' && columnKind !== 'signed') {
        hasDirectionalAmountColumn = true;
      }

      if (mapping.targetField === 'date') hasDateMapping = true;

      const index = columnIndices.get(mapping.sourceColumn);
      if (index === undefined || !row[index]) continue;
      const value = row[index];

      // Special handling for amount fields
      if (mapping.targetField === 'amount') {
        const parsedAmount = this.parseAmount(value);
        // Keep the parsed sign — orientation is applied in the resolution
        // step below so reversals (negative debit / negative credit cells)
        // survive.
        if (columnKind === 'outflow') {
          outflowCell = parsedAmount;
        } else if (columnKind === 'inflow') {
          inflowCell = parsedAmount;
        } else {
          // Single signed amount column - use as is
          transaction.amount = parsedAmount;
        }
      } else if (mapping.targetField === 'type') {
        // Explicit type column (e.g. the Mint profile). Normalized here and
        // honoured in the resolution step instead of writing the raw cell
        // (values like 'debit' are not valid Transaction types).
        const rawType = mapping.transform ? mapping.transform(value) : value;
        explicitType = typeof rawType === 'string' ? this.normalizeTypeCell(rawType) : null;
      } else if (mapping.targetField === 'date') {
        // THE CELL, NOT THE TRANSFORM. A date is the one field where a
        // transform could quietly substitute today's date for a cell nobody
        // could read (suggestMappings hands out exactly such a closure), and a
        // redated statement line is worse than a rejected one: it reconciles
        // against nothing and it is not where anybody will look for it. The raw
        // cell is kept and resolved once, below, where a failure can be
        // reported as a failure.
        dateCell = value;
      } else if (mapping.transform) {
        (transaction as Record<string, JsonValue>)[mapping.targetField] = mapping.transform(value);
      } else {
        (transaction as Record<string, JsonValue>)[mapping.targetField] = value;
      }
    }

    // Resolve separate debit/credit columns. A debit column stores money-out
    // magnitudes, so its parsed value is negated into the signed convention;
    // a credit column already carries the money-in orientation. Zero cells
    // carry no direction and are ignored.
    let amountResolved = false;
    if (hasDirectionalAmountColumn) {
      const signedFromOutflow = outflowCell !== null && outflowCell !== 0 ? -outflowCell : null;
      const signedFromInflow = inflowCell !== null && inflowCell !== 0 ? inflowCell : null;
      const signedAmount = signedFromOutflow ?? signedFromInflow;
      if (signedAmount !== null) {
        transaction.amount = signedAmount;
        transaction.type = signedAmount < 0 ? 'expense' : 'income';
        amountResolved = true;
      } else if (transaction.amount === undefined) {
        return { ok: false, error: 'No non-zero amount found in the debit/credit columns' };
      }
    }

    if (!amountResolved) {
      if (explicitType !== null && transaction.amount !== undefined) {
        if (transaction.amount < 0) {
          // A negative amount means the source is SIGNED: the sign is
          // authoritative and beats a contradictory type cell. Only
          // 'transfer' is compatible with money-out; anything else resolves
          // to expense. The amount keeps its source sign.
          transaction.type = explicitType === 'transfer' ? 'transfer' : 'expense';
        } else {
          // Non-negative amounts next to an explicit type cell are unsigned
          // magnitudes (Mint-style): classify by the type cell and sign the
          // magnitude accordingly (a positive 'transfer' stays positive —
          // transfer-in under the signed convention).
          transaction.type = explicitType;
          transaction.amount = signTransactionAmount(transaction.amount, explicitType, false);
        }
      } else if (explicitType !== null) {
        transaction.type = explicitType;
      } else if (transaction.amount && transaction.amount < 0) {
        // Determine transaction type from a single signed amount column and
        // keep the amount signed (expense negative, income positive).
        transaction.type = 'expense';
      } else if (transaction.amount && transaction.amount > 0) {
        transaction.type = 'income';
      }
    }

    // ── The two refusals ────────────────────────────────────────────────────
    //
    // Both used to be silent, and both wrote something untrue into the
    // register: a row with no readable date arrived dated today (or, from an
    // empty cell, as an Invalid Date), and a row whose amount column was not
    // mapped at all arrived at £0.00 — a transaction that balances nothing and
    // that the user must find and delete one at a time. Refused rows are
    // COUNTED and NAMED by both callers: the preview shows them as skipped
    // before anything is written, and the result step lists them by row number.
    if (hasDateMapping) {
      // ONE FORMAT, APPLIED TO EVERY CELL, AND NAMED WHEN IT REFUSES. The
      // refusal is the format's own words — "There is no month 13 — '13/06/2026'
      // is being read as MM/DD/YYYY (month first)" — because the row is not
      // broken, the setting is, and a message that does not say so sends the
      // user off to correct their bank's export.
      const parsed = parseCsvDateCell(dateCell ?? '', dateFormat);
      if (!parsed.ok) {
        return { ok: false, error: parsed.reason };
      }
      transaction.date = new Date(parsed.iso);
    }

    if (transaction.amount === undefined) {
      return { ok: false, error: 'No amount in this row' };
    }

    return { ok: true, transaction };
  }

  /**
   * Check for duplicate transactions
   */
  async checkDuplicateTransaction(
    transaction: Partial<Transaction>,
    existingTransactions: Transaction[]
  ): Promise<DuplicateCheckResult> {
    const matches: DuplicateCheckResult['matches'] = [];
    let highestConfidence = 0;
    
    for (const existing of existingTransactions) {
      // Check date proximity (within 3 days)
      const dateDiff = Math.abs(
        new Date(transaction.date!).getTime() - new Date(existing.date).getTime()
      );
      const dateProximity = dateDiff < 3 * DAY_IN_MS;
      
      if (!dateProximity) continue;
      
      // Check amount similarity
      const amountDiff = Math.abs((transaction.amount || 0) - existing.amount);
      const amountMatch = amountDiff < 0.01;
      
      // Check description similarity
      const descSimilarity = this.calculateSimilarity(
        transaction.description?.toLowerCase() || '',
        existing.description.toLowerCase()
      );
      
      // Calculate overall confidence
      let confidence = 0;
      if (amountMatch) confidence += 40;
      if (dateProximity) confidence += 30;
      if (descSimilarity > 0.8) confidence += 30;
      
      if (confidence >= 70) {
        matches.push({
          id: existing.id,
          field: 'transaction',
          similarity: confidence
        });
        highestConfidence = Math.max(highestConfidence, confidence);
      }
    }
    
    return {
      isDuplicate: highestConfidence >= 90,
      confidence: highestConfidence,
      matches
    };
  }

  /**
   * Import with mapping and duplicate detection
   */
  async importTransactions(
    csvContent: string,
    mappings: ColumnMapping[],
    existingTransactions: Transaction[],
    accountMap: Map<string, string>,
    options: {
      skipDuplicates?: boolean;
      duplicateThreshold?: number;
      categories?: Category[];
      autoCategorize?: boolean;
      categoryConfidenceThreshold?: number;
      /**
       * Which way round this file's dates are. The wizard has already resolved
       * it — from the file's own evidence, from a bank template, or from the
       * user — and passes the ANSWER, so the preview and the write cannot read
       * the same column two different ways.
       */
      dateFormat?: CsvDateFormat;
      /** Where the heading row is, when it is not where detection put it. */
      headerLine?: number;
    } = {}
  ): Promise<ImportResult> {
    const { headers, data, lines } = this.parseCSV(csvContent, { headerLine: options.headerLine });
    const dateFormat = options.dateFormat ?? SUGGESTED_AMBIGUOUS_FORMAT;
    const result: ImportResult = {
      success: 0,
      failed: 0,
      duplicates: 0,
      items: [],
      errors: []
    };
    
    // Create column index map keyed by SOURCE column (unique). Bank formats
    // (Lloyds, Halifax, Nationwide, …) map TWO source columns — "Debit Amount"
    // and "Credit Amount" — to the same 'amount' target; a targetField-keyed
    // map collapsed them to one index, so the debit mapping read the credit
    // column's cell and debit-only rows imported with no amount at all.
    const columnIndices = new Map<string, number>();
    mappings.forEach(mapping => {
      const index = headers.findIndex(h => h === mapping.sourceColumn);
      if (index >= 0) {
        columnIndices.set(mapping.sourceColumn, index);
      }
    });
    
    // Process each row
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      
      try {
        const built = this.buildTransactionFromRow(row, mappings, columnIndices, dateFormat);
        if (!built.ok) {
          result.failed++;
          result.errors.push({
            // The row's own physical line, counted by the tokenizer. `+ 2` was
            // only ever right for a file with no preamble and no multi-line
            // field.
            line: lines[rowIndex],
            error: built.error
          });
          continue;
        }
        const transaction = built.transaction;

        // ── Map account name to ID ─────────────────────────────────────────
        //
        // A NAME THAT MATCHED NOTHING IS KEPT. It used to be deleted either
        // way, leaving `accountId: 'default'` and no trace of what the file had
        // said — so the wizard, which checks for a surviving name to tell "this
        // file named an account you do not have" apart from "this file names no
        // account at all", could only ever report the second. A user whose CSV
        // said "Barclays Everyday" was told no account column was mapped, and
        // sent to fix a mapping that was already right.
        if (transaction.accountName) {
          const matched = accountMap.get(String(transaction.accountName));
          if (matched) {
            transaction.accountId = matched;
            delete transaction.accountName;
          } else {
            transaction.accountId = 'default';
          }
        }
        
        // Check for duplicates
        if (options.skipDuplicates !== false) {
          const duplicateCheck = await this.checkDuplicateTransaction(
            transaction,
            existingTransactions
          );
          
          if (duplicateCheck.confidence >= (options.duplicateThreshold || 90)) {
            result.duplicates++;
            continue;
          }
        }
        
        // A category that reached this point came from a MAPPED COLUMN — the
        // user's own file said it, and the wizard's mapping is the user telling
        // us which column it is. That is their data, so it arrives confirmed.
        // Only the guess below is a suggestion.
        transaction.categoryConfirmed = true;

        // Auto-categorize if enabled and no category is set
        if (options.autoCategorize && options.categories && !transaction.category) {
          // Train the model if we have existing transactions
          if (existingTransactions.length > 0) {
            this.categorizationService.learnFromTransactions(existingTransactions, options.categories);
          }

          // Get category suggestions
          const suggestions = this.categorizationService.suggestCategories(transaction as Transaction, 1);

          if (suggestions.length > 0) {
            const confidenceThreshold = options.categoryConfidenceThreshold || 0.7;
            if (suggestions[0].confidence >= confidenceThreshold) {
              transaction.category = suggestions[0].categoryId;
              // The app's guess, marked as one so the register can show it as a
              // suggestion and take a one-click confirm.
              transaction.categoryConfirmed = false;
            }
          }
        }
        
        // Apply import rules
        const processedTransaction = this.rulesService.applyRules(transaction);
        
        // Skip transaction if rules indicate to skip
        if (!processedTransaction) {
          continue;
        }
        
        // Add transaction
        processedTransaction.id = this.createId('import', rowIndex);
        result.items.push(processedTransaction as Transaction);
        result.success++;
        
      } catch (error) {
        result.failed++;
        result.errors.push({
          line: lines[rowIndex],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return result;
  }

  /**
   * Save import profile
   */
  saveProfile(profile: ImportProfile): void {
    const existing = this.profiles.findIndex(p => p.id === profile.id);
    if (existing >= 0) {
      this.profiles[existing] = profile;
    } else {
      this.profiles.push(profile);
    }
    
    this.saveProfiles();
  }

  /**
   * Get saved profiles.
   *
   * No filter argument any more: they are all transaction profiles, because
   * that is the only kind of CSV import this app has ever performed. The
   * argument used to be `type`, and passing 'account' returned the profiles for
   * a feature that wrote nothing.
   */
  getProfiles(): ImportProfile[] {
    return this.profiles;
  }

  /**
   * The names of saved profiles that were thrown away on load, said ONCE.
   *
   * Reading this clears it. A notice about a one-time migration that reappears
   * on every visit is noise, and noise is how the notices that matter get
   * ignored.
   */
  consumeDiscardedProfileNotice(): string[] {
    const discarded = this.discardedProfileNames;
    this.discardedProfileNames = [];
    return discarded;
  }

  /**
   * Forget a saved profile.
   *
   * There was no way to do this at all: profiles could be created and never
   * removed, so a mis-saved one sat in the list for good and a list of six
   * near-identical names became the reason nobody used the feature. Returns
   * whether anything was removed, so a caller cannot report a deletion that
   * did not happen.
   */
  deleteProfile(id: string): boolean {
    const before = this.profiles.length;
    this.profiles = this.profiles.filter(profile => profile.id !== id);
    if (this.profiles.length === before) return false;
    this.saveProfiles();
    return true;
  }

  /**
   * Rename a saved profile, keeping its id — anything holding that id (the
   * wizard's current selection) keeps working across the rename.
   */
  renameProfile(id: string, name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const profile = this.profiles.find(entry => entry.id === id);
    if (!profile) return false;
    profile.name = trimmed;
    this.saveProfiles();
    return true;
  }

  /**
   * Load profiles from localStorage.
   *
   * ── WHY EVERY FIELD IS CHECKED ──────────────────────────────────────────────
   * This used to be `JSON.parse(saved)` handed back as `ImportProfile[]` on the
   * strength of the type annotation alone. Whatever was in that key — a half
   * written value, something from an older shape of this app, another tab's
   * mistake — became "profiles", and the first thing to read `.mappings.map`
   * threw inside a render. Storage is not a type system: what comes back is
   * unknown until it has been looked at, so it is looked at.
   *
   * `lastUsed` is rebuilt as a Date because JSON has no date type; it goes out
   * as a string and would come back as one while the type says otherwise.
   *
   * ── AND THE PROFILES FOR THE IMPORT THAT NEVER EXISTED ARE DROPPED ──────────
   * A stored profile marked `type: 'account'` is discarded here, once, and its
   * name is kept so the wizard can say so. The alternative was to coerce it into
   * a transaction profile, and that would be worse than useless: its columns
   * name `name`, `balance` and `institution`, none of which a transaction has,
   * so loading it would apply zero mappings and report every column as "not
   * imported by this app" — a profile that does nothing, presented as a profile,
   * with no hint of why. Dropping it says what happened; coercing it hides that
   * the app ever offered the thing.
   *
   * The discard is written back so it happens once rather than on every load.
   */
  private loadProfiles(): ImportProfile[] {
    if (!this.storage) return [];
    try {
      const saved = this.storage.getItem('csvImportProfiles');
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      const stored = parsed.filter(isImportProfile);
      const dead = stored.filter(isDeadAccountProfile);
      this.discardedProfileNames = dead.map(profile => profile.name);

      const profiles = stored.filter(profile => !isDeadAccountProfile(profile)).map(profile => {
        // Rebuilt field by field rather than spread: `type` was on the stored
        // shape and is not on this one, and a spread would carry it straight
        // back out to storage on the next save.
        const rebuilt: ImportProfile = {
          id: profile.id,
          name: profile.name,
          mappings: profile.mappings
        };
        if (profile.lastUsed !== undefined) rebuilt.lastUsed = toDate(profile.lastUsed);
        if (profile.bank !== undefined) rebuilt.bank = profile.bank;
        if (profile.skipDuplicates !== undefined) rebuilt.skipDuplicates = profile.skipDuplicates;
        if (profile.duplicateThreshold !== undefined) {
          rebuilt.duplicateThreshold = profile.duplicateThreshold;
        }
        if (isStoredDateFormat(profile.dateFormat)) rebuilt.dateFormat = profile.dateFormat;
        return rebuilt;
      });

      if (dead.length > 0) {
        this.profiles = profiles;
        this.saveProfiles();
      }
      return profiles;
    } catch (error) {
      this.logger.warn('Failed to load import profiles from storage:', error as Error);
      return [];
    }
  }

  /**
   * Save profiles to localStorage
   */
  private saveProfiles(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem('csvImportProfiles', JSON.stringify(this.profiles));
    } catch (error) {
      this.logger.error('Failed to save import profiles:', error as Error);
    }
  }

  /**
   * Build the first few transactions a file would produce, exactly as
   * importTransactions would build them.
   *
   * HEADERS ARE A SEPARATE ARGUMENT ON PURPOSE. This used to take one
   * `data: string[][]` and read `data[0]` as the header row, so a caller
   * holding the output of `parseCSV` — which returns headers and DATA
   * separately, the data already stripped of its header — got a preview built
   * against the first transaction as though it were the column names: every
   * column index missed, and the preview came back empty. Nothing in the shape
   * of the old signature could tell the two callers apart. Now the two are
   * named, and passing rows where headers belong will not type-check.
   *
   * `rows` must NOT include the header row.
   */
  generatePreview(
    headers: string[],
    rows: string[][],
    mappings: ColumnMapping[],
    dateFormat: CsvDateFormat = SUGGESTED_AMBIGUOUS_FORMAT
  ): { transactions: Partial<Transaction>[] } {
    const transactions: Partial<Transaction>[] = [];

    // Process first 10 rows as preview
    for (const outcome of this.buildRows(headers, rows.slice(0, 10), mappings, dateFormat)) {
      if (outcome.ok) transactions.push(outcome.transaction);
    }

    return { transactions };
  }

  /**
   * Every row of a file, each one either built or refused WITH ITS REASON, in
   * the file's own order.
   *
   * ── WHY THE REASONS TRAVEL WITH THE ROWS ────────────────────────────────────
   * `generatePreview` drops what it cannot build, so a caller comparing its
   * output against the file cannot tell which row went missing or why — and a
   * preview that quietly omits three rows of a statement is how somebody spends
   * an evening hunting for them in the register afterwards. The wizard needs
   * both halves: the built values to print, and the refusals to count and name
   * BEFORE anything is written.
   *
   * Same builder as the import, so a row shown here as skipped is a row the
   * import will skip, and a figure shown here is the figure that will be
   * written. `rows` must NOT include the header row.
   */
  buildRows(
    headers: string[],
    rows: string[][],
    mappings: ColumnMapping[],
    dateFormat: CsvDateFormat = SUGGESTED_AMBIGUOUS_FORMAT
  ): RowBuildResult[] {
    // Create column index map, keyed by SOURCE column — see importTransactions:
    // two bank columns (Debit/Credit) can map to the same 'amount' target.
    const columnIndices = new Map<string, number>();
    mappings.forEach(mapping => {
      const index = headers.findIndex(h => h === mapping.sourceColumn);
      if (index >= 0) {
        columnIndices.set(mapping.sourceColumn, index);
      }
    });

    return rows.map((row, rowIndex) => {
      try {
        const built = this.buildTransactionFromRow(row, mappings, columnIndices, dateFormat);
        if (!built.ok) return built;
        return {
          ok: true as const,
          transaction: { ...built.transaction, id: this.createId('preview', rowIndex) }
        };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * The mappings a shipped bank template prefills, by id.
   *
   * Returns `[]` for an id this app does not ship — which is now unreachable
   * from the UI, because the list the user picks from IS this registry. It was
   * very reachable before: the template buttons were a separate hand-typed list
   * of names, and half of them (MBNA, Amex, Bank of America, Chase UK…) matched
   * no id here, so the button silently returned nothing and the wizard walked
   * the user to an empty mapping step.
   */
  getBankMappings(bank: string): ColumnMapping[] {
    const template = BANK_TEMPLATES.find(entry => entry.id === bank.toLowerCase().trim());
    return template ? template.mappings.map(mapping => ({ ...mapping })) : [];
  }

  /**
   * Every template this app ships, label and all — the list the user chooses
   * from. Sorted by region in the declared order, then alphabetically inside
   * each region, so the list is stable across releases.
   */
  listBankTemplates(): BankTemplate[] {
    return [...BANK_TEMPLATES].sort((a, b) => {
      const byRegion =
        BANK_TEMPLATE_REGIONS.indexOf(a.region) - BANK_TEMPLATE_REGIONS.indexOf(b.region);
      return byRegion !== 0 ? byRegion : a.label.localeCompare(b.label);
    });
  }

  /**
   * Which of the three fields a file cannot be imported without are still
   * unmapped — counting ONLY mappings whose source column exists in this file.
   *
   * That last clause is the point. A template or a saved profile names columns
   * from some other file; a mapping pointing at a column this file does not
   * have is not a mapping, and treating it as one is how an import of 900 rows
   * arrives with every amount at zero. See REQUIRED_TRANSACTION_FIELDS for what
   * each missing field costs.
   */
  missingRequiredFields(mappings: ColumnMapping[], headers: string[]): string[] {
    const present = new Set(
      mappings
        .filter(mapping => headers.includes(mapping.sourceColumn))
        .map(mapping => mapping.targetField)
    );
    return REQUIRED_TRANSACTION_FIELDS.filter(field => !present.has(field));
  }
}

export const enhancedCsvImportService = new EnhancedCsvImportService();
