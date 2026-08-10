import type { Transaction, Account, Category } from '../types';
import { smartCategorizationService } from './smartCategorizationService';
import { importRulesService } from './importRulesService';
import type { JsonValue } from '../types/common';
import { toDecimal, toNumber } from '../utils/decimal';
import { signTransactionAmount } from '../utils/transactionAmount';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Column-name keywords marking the money-out / money-in halves of two-column
// bank formats. Matched as substrings of the lowercased source column name,
// so 'withdrawal' also covers 'Withdrawals' / 'WITHDRAWALS' / 'Withdrawal
// Amount'. 'Dare'/'Avere' are the Italian debit/credit column names
// (intesa-sanpaolo profile).
const OUTFLOW_COLUMN_KEYWORDS = ['debit', 'paid out', 'money out', 'withdrawal', 'dare'];
const INFLOW_COLUMN_KEYWORDS = ['credit', 'paid in', 'money in', 'deposit', 'avere'];

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

export interface ImportProfile {
  id: string;
  name: string;
  type: 'transaction' | 'account';
  mappings: ColumnMapping[];
  dateFormat?: string;
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
    row: number;
    error: string;
  }>;
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
 */
const BANK_TEMPLATES: readonly BankTemplate[] = [
  // ── UK ────────────────────────────────────────────────────────────────────
  {
    id: 'barclays',
    label: 'Barclays',
    region: 'UK',
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
 * and is a string again. Kept separate from {@link ImportProfile} so the
 * difference is stated rather than assumed away.
 */
type StoredProfile = Omit<ImportProfile, 'lastUsed'> & { lastUsed?: string | number | Date };

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
  if (candidate.type !== 'transaction' && candidate.type !== 'account') return false;
  return Array.isArray(candidate.mappings) && candidate.mappings.every(isColumnMapping);
};

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

  private createDate(offsetMs = 0): Date {
    return new Date(this.nowProvider() + offsetMs);
  }

  private getCurrentDateString(): string {
    return this.createDate().toISOString().split('T')[0];
  }

  private createId(prefix: string, index: number): string {
    return `${prefix}-${this.nowProvider()}-${index}-${this.idCounter++}`;
  }

  /**
   * Parse CSV with intelligent header detection
   */
  parseCSV(content: string): { headers: string[]; data: string[][] } {
    // A BLANK LINE IS NOT A ROW. Files that end with one, or that separate
    // months with one, produced an empty row apiece — counted as a row in the
    // preview and reported afterwards as a row that could not be read, which is
    // an error report about nothing. Dropped here, in the one parse both the
    // preview and the import go through, so the two cannot disagree about how
    // many rows the file has. ('\r' is what a Windows line ending leaves behind
    // after the split, so it is trimmed before the test.)
    const lines = content.trim().split('\n').filter(line => line.trim() !== '');
    const rows: string[][] = [];

    for (const line of lines) {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      row.push(current.trim());
      rows.push(row);
    }
    
    // Detect headers (first row with text content)
    const headers = rows[0] || [];
    const data = rows.slice(1);
    
    return { headers, data };
  }

  /**
   * Smart column mapping using fuzzy matching
   */
  suggestMappings(headers: string[], type: 'transaction' | 'account'): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    if (type === 'transaction') {
      // Date mapping
      const datePatterns = ['date', 'transaction date', 'posted', 'trans date', 'value date'];
      const dateIndex = this.findBestMatch(normalizedHeaders, datePatterns);
      if (dateIndex >= 0) {
        mappings.push({
          sourceColumn: headers[dateIndex],
          targetField: 'date',
          transform: (value: string) => this.parseDate(value)
        });
      }
      
      // Description mapping
      const descPatterns = ['description', 'desc', 'memo', 'details', 'transaction'];
      const descIndex = this.findBestMatch(normalizedHeaders, descPatterns);
      if (descIndex >= 0) {
        mappings.push({
          sourceColumn: headers[descIndex],
          targetField: 'description'
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
        .filter(({ index }) => index !== dateIndex && index !== descIndex)
        .filter(({ header }) => this.classifyAmountColumn(header) !== 'signed')
        .map(({ index }) => index);

      if (directionalIndices.length > 0) {
        for (const index of directionalIndices) {
          mappings.push({
            sourceColumn: headers[index],
            targetField: 'amount',
            transform: (value: string) => this.parseAmount(value)
          });
        }
      } else {
        const amountPatterns = ['amount', 'value', 'charge'];
        const amountIndex = this.findBestMatch(normalizedHeaders, amountPatterns);
        if (amountIndex >= 0) {
          mappings.push({
            sourceColumn: headers[amountIndex],
            targetField: 'amount',
            transform: (value: string) => this.parseAmount(value)
          });
        }
      }

      // Category mapping
      const categoryPatterns = ['category', 'cat', 'type', 'classification'];
      const categoryIndex = this.findBestMatch(normalizedHeaders, categoryPatterns);
      if (categoryIndex >= 0) {
        mappings.push({
          sourceColumn: headers[categoryIndex],
          targetField: 'category'
        });
      }
      
      // Account mapping
      const accountPatterns = ['account', 'acc', 'account name', 'from account'];
      const accountIndex = this.findBestMatch(normalizedHeaders, accountPatterns);
      if (accountIndex >= 0) {
        mappings.push({
          sourceColumn: headers[accountIndex],
          targetField: 'accountName'
        });
      }
    } else {
      // Account mappings
      const namePatterns = ['name', 'account name', 'account', 'description'];
      const nameIndex = this.findBestMatch(normalizedHeaders, namePatterns);
      if (nameIndex >= 0) {
        mappings.push({
          sourceColumn: headers[nameIndex],
          targetField: 'name'
        });
      }
      
      const balancePatterns = ['balance', 'current balance', 'amount', 'value'];
      const balanceIndex = this.findBestMatch(normalizedHeaders, balancePatterns);
      if (balanceIndex >= 0) {
        mappings.push({
          sourceColumn: headers[balanceIndex],
          targetField: 'balance',
          transform: (value: string) => this.parseAmount(value)
        });
      }
      
      const typePatterns = ['type', 'account type', 'category'];
      const typeIndex = this.findBestMatch(normalizedHeaders, typePatterns);
      if (typeIndex >= 0) {
        mappings.push({
          sourceColumn: headers[typeIndex],
          targetField: 'type'
        });
      }
    }
    
    return mappings;
  }

  /**
   * Find best matching header using fuzzy search
   */
  private findBestMatch(headers: string[], patterns: string[]): number {
    let bestIndex = -1;
    let bestScore = 0;
    
    for (let i = 0; i < headers.length; i++) {
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
   * Parse date with multiple format support
   */
  private parseDate(value: string): string {
    const parsed = this.tryParseDate(value);
    if (parsed !== null) return parsed;

    // Default to today if parsing fails.
    //
    // KEPT ONLY FOR THE TRANSFORM CLOSURES suggestMappings hands out, which are
    // typed to return a value and have no way to say "no". The IMPORT no longer
    // travels this road: buildTransactionFromRow calls tryParseDate and refuses
    // the row, because a statement line silently redated to today is a
    // transaction that reconciles against nothing and that nobody can find by
    // looking where it should be.
    this.logger.warn(`Cannot parse date: ${value}, using today's date`);
    return this.getCurrentDateString();
  }

  /**
   * A date cell as an ISO day, or null when the cell says nothing this app can
   * read. Null is the honest answer and the caller must handle it.
   */
  private tryParseDate(value: string): string | null {
    const trimmed = value.trim();
    // An empty cell is not a date and never was. It used to reach the import as
    // "no date at all", and the wizard turned that into `new Date('undefined')`
    // — a row written with an Invalid Date, which no register can sort and no
    // reconciliation can find.
    if (!trimmed) return null;

    // First, try standard Date parsing
    let date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Try DD/MM/YYYY format (common in UK)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/');
      date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    // Try DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('-');
      date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    // Try MM/DD/YYYY format (US format)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [month, day, year] = trimmed.split('/');
      date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    return null;
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
    if (OUTFLOW_COLUMN_KEYWORDS.some(keyword => name.includes(keyword))) return 'outflow';
    if (INFLOW_COLUMN_KEYWORDS.some(keyword => name.includes(keyword))) return 'inflow';
    return 'signed';
  }

  /**
   * Normalize an explicit type-column cell (e.g. Mint's "Transaction Type")
   * to a transaction type. Returns null for unrecognized values so callers
   * fall back to sign-derived classification.
   */
  private normalizeTypeCell(value: string): Transaction['type'] | null {
    switch (value.trim().toLowerCase()) {
      case 'debit':
      case 'withdrawal':
      case 'expense':
        return 'expense';
      case 'credit':
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
    columnIndices: Map<string, number>
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
      const isoDate = dateCell === null ? null : this.tryParseDate(dateCell);
      if (isoDate === null) {
        return {
          ok: false,
          error: dateCell
            ? `Unreadable date: "${dateCell}"`
            : 'No date in this row'
        };
      }
      transaction.date = new Date(isoDate);
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
    } = {}
  ): Promise<ImportResult> {
    const { headers, data } = this.parseCSV(csvContent);
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
        const built = this.buildTransactionFromRow(row, mappings, columnIndices);
        if (!built.ok) {
          result.failed++;
          result.errors.push({
            row: rowIndex + 2, // +1 for header, +1 for 1-based indexing
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
          row: rowIndex + 2, // +1 for header, +1 for 1-based indexing
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
   * Get saved profiles
   */
  getProfiles(type?: 'transaction' | 'account'): ImportProfile[] {
    if (type) {
      return this.profiles.filter(p => p.type === type);
    }
    return this.profiles;
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
   */
  private loadProfiles(): ImportProfile[] {
    if (!this.storage) return [];
    try {
      const saved = this.storage.getItem('csvImportProfiles');
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isImportProfile).map(profile => ({
        ...profile,
        lastUsed: profile.lastUsed === undefined ? undefined : toDate(profile.lastUsed)
      }));
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
    mappings: ColumnMapping[]
  ): { transactions: Partial<Transaction>[] } {
    const transactions: Partial<Transaction>[] = [];

    // Process first 10 rows as preview
    for (const outcome of this.buildRows(headers, rows.slice(0, 10), mappings)) {
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
    mappings: ColumnMapping[]
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
        const built = this.buildTransactionFromRow(row, mappings, columnIndices);
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
