// THE ORACLE — the real TypeScript, driven from the harness's own payload.
//
// This file is bundled by esbuild (see admission-typescript.mjs) and therefore
// imports `src/` modules directly, `.ts` and all. It is the ONLY place in the
// harness that reads `src/`, and it reads it — nothing here writes to `src/`,
// patches it, or re-implements any part of it.
//
// WHAT AN ADAPTER MAY DO, AND WHAT IT MAY NOT
// -------------------------------------------
// The verb harness sends ONE payload to two engines because "if the two engines
// needed different commands they would not be implementations of the same verb"
// (lib/verb-specs.mjs). The same rule holds here, and it needs one more
// sentence, because the two sides of THIS comparison do not even take the same
// KINDS of value: the TypeScript takes JavaScript numbers and Dates because it
// runs after a parser has already converted them, and the Rust takes decimal
// strings because Money is an integer type at the boundary.
//
// So an adapter is allowed to:
//
//   * RENAME — `fit_id` → `fitId`, `held_date` → `heldDate`;
//   * RE-RENDER — a money string into the number the TypeScript's own callers
//     hand it, a Date back into a calendar day, a Set into an array;
//   * BUILD A FIXTURE — for the four `cleared` policies, whose TypeScript is a
//     line inside a whole importer, the payload's `{source, cleared_flag}` is
//     turned into a one-row file of that format. That is the same allowance
//     `verb-specs.mjs` already makes for `setup: { sqlite, postgres }`, which is
//     per-engine SQL for one starting state.
//
// And it is NOT allowed to DECIDE anything: no branch here may depend on
// something the TypeScript function has not already answered. Where the port
// carries a field the TypeScript has no counterpart for, the spec declares it
// `rustOnly` with a reason — it is never computed here.
//
// THE ONE PLACE THAT RULE IS LOAD-BEARING
// ---------------------------------------
// `money()` below refuses to render a value that is not exact to the penny.
// Rounding it quietly is precisely how an adapter would hide the divergence
// this lane exists to measure, so it raises a HARNESS ERROR instead and the
// spec has to declare what it found.

import { findStatementDuplicates } from '../../../src/utils/statementDuplicates';
import { planStatementBankBalance } from '../../../src/utils/statementBankBalance';
import { findFeedOverlap } from '../../../src/services/import/msMoney/feedOverlap';
import {
  findAccountByOfxIdentifiers,
  planAccountDetailsBackfill,
  readOfxAccountIdentifiers,
} from '../../../src/utils/ofxAccountIdentifiers';
import { isSelfTransferCategory } from '../../../src/utils/transferMatch';
import { ofxImportService } from '../../../src/services/ofxImportService';
import { qifImportService } from '../../../src/services/qifImportService';
import { enhancedCsvImportService } from '../../../src/services/enhancedCsvImportService';
import { transformMsMoneyExport } from '../../../src/services/import/msMoney/transform';
import { Decimal } from '../../../src/utils/decimal';

/**
 * A money value as the decimal string both sides are compared on.
 *
 * Deliberately strict: a number that is not exact to the penny cannot be
 * rendered here, because doing so would round it and the rounding would be the
 * adapter's, not the module's. See the header.
 */
function money(value) {
  const decimal = new Decimal(value);
  if (!decimal.toDecimalPlaces(2).equals(decimal)) {
    throw new Error(
      `the TypeScript produced ${value}, which is not exact to the penny — ` +
      'the adapter will not round it; the spec must declare what it found',
    );
  }
  return decimal.toFixed(2);
}

/** A Date back into the calendar day it stands for, or null for an Invalid Date. */
function isoDay(value) {
  const ms = value instanceof Date ? value.getTime() : Number.NaN;
  return Number.isFinite(ms) ? value.toISOString().slice(0, 10) : null;
}

/** The number the TypeScript's own callers hand it, from the payload's text. */
const asNumber = (text) => Number(text);

// ── plan_statement_duplicates ───────────────────────────────────────────────

function statementDuplicates(payload) {
  const incoming = payload.incoming.map((row) => ({
    date: row.date ?? null,
    amount: asNumber(row.amount),
    description: row.description ?? '',
    fitId: row.fit_id ?? null,
  }));
  const held = payload.held.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    date: row.date ?? null,
    amount: asNumber(row.amount),
    description: row.description ?? '',
    notes: row.notes ?? undefined,
    cleared: row.cleared ?? undefined,
  }));
  const options = payload.date_tolerance_days === undefined || payload.date_tolerance_days === null
    ? {}
    : { dateToleranceDays: payload.date_tolerance_days };

  const found = findStatementDuplicates(incoming, held, payload.account_id, options);
  const asMatch = (match) => ({
    incoming_index: match.incomingIndex,
    fit_id: match.fitId,
    held_id: match.heldId,
    held_description: match.heldDescription,
    held_date: isoDay(match.heldDate),
    held_amount: money(match.heldAmount),
    held_cleared: match.heldCleared,
    basis: match.basis,
    day_gap: match.dayGap,
    description_similarity: match.descriptionSimilarity,
  });
  return { certain: found.certain.map(asMatch), possible: found.possible.map(asMatch) };
}

// ── plan_statement_bank_balance ─────────────────────────────────────────────

function statementBankBalance(payload) {
  const statement = payload.statement
    ? { amount: asNumber(payload.statement.amount), dateAsOf: payload.statement.date_as_of }
    : undefined;
  const account = payload.account
    ? {
        bankBalance: payload.account.bank_balance === undefined || payload.account.bank_balance === null
          ? null
          : asNumber(payload.account.bank_balance),
        bankBalanceDate: payload.account.bank_balance_date ?? null,
      }
    : null;

  const outcome = planStatementBankBalance(statement, account, {
    destinationConfirmed: payload.destination_confirmed,
  });

  if (outcome.kind === 'set') {
    return {
      kind: 'set',
      updates: {
        bank_balance: money(outcome.updates.bankBalance),
        bank_balance_date: outcome.updates.bankBalanceDate,
      },
      amount: money(outcome.amount),
      date_as_of: outcome.dateAsOf,
    };
  }
  if (outcome.kind === 'stale') {
    return {
      kind: 'stale',
      recorded_date: outcome.recordedDate,
      recorded_balance: money(outcome.recordedBalance),
    };
  }
  return { kind: 'none' };
}

// ── plan_feed_overlap ───────────────────────────────────────────────────────

function feedOverlap(payload) {
  const transactions = payload.transactions.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    date: row.date ?? null,
    amount: asNumber(row.amount),
    description: row.description ?? '',
    type: row.type,
    isSplit: row.is_split ?? false,
    transferAccountId: row.transfer_account_id ?? undefined,
    linkedTransferId: row.linked_transfer_id ?? undefined,
    linkedTransferSplitId: row.linked_transfer_split_id ?? undefined,
  }));
  // `ExistingFeedTransaction.amount` is `string | number` and the module parses
  // it through Decimal either way, so the payload's own text goes straight
  // across without ever becoming a double.
  const feedRows = payload.feed_rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    date: row.date ?? '',
    amount: row.amount,
    description: row.description ?? '',
    isSplit: row.is_split ?? false,
    linkedTransferId: row.linked_transfer_id ?? null,
  }));
  const options = payload.date_tolerance_days === undefined || payload.date_tolerance_days === null
    ? {}
    : { dateToleranceDays: payload.date_tolerance_days };

  const found = findFeedOverlap(transactions, feedRows, options);
  return {
    matches: found.matches.map((match) => ({
      import_source_id: match.importSourceId,
      feed_transaction_id: match.feedTransactionId,
      account_id: match.accountId,
      day_gap: match.dayGap,
      description_similarity: match.descriptionSimilarity,
      is_transfer_handover: match.isTransferHandover,
    })),
    suppressed_source_ids: [...found.suppressedSourceIds],
    unmatched_feed_ids: found.unmatchedFeedIds,
    kept_despite_overlap: {
      transfers: found.keptDespiteOverlap.transfers,
      split_parents: found.keptDespiteOverlap.splitParents,
    },
    transfer_handovers: found.transferHandovers.map((handover) => ({
      import_source_id: handover.importSourceId,
      feed_transaction_id: handover.feedTransactionId,
      account_id: handover.accountId,
      transfer_account_id: handover.transferAccountId,
      counterpart_source_id: handover.counterpartSourceId,
      counterpart_split_source_id: handover.counterpartSplitSourceId,
      day_gap: handover.dayGap,
      description_similarity: handover.descriptionSimilarity,
    })),
  };
}

// ── plan_cleared_flag ───────────────────────────────────────────────────────
//
// The four policies are four LINES in four importers, not four functions, so
// the oracle is the importer itself: a one-row file of that format goes in and
// the row that comes out is read. Every one of the four is drivable with pure
// inputs — no database, no network, no browser — which is why this is a real
// differential and not a constant typed into the harness.
//
// Where the flag goes, per format, and where it deliberately does not:
//
//   qif       a `C` line carrying it. The one format that states a
//             reconciliation status of its own.
//   ms_money  `clearedStatus`, as Money's own 0/1/2 code.
//   ofx       NOWHERE. OFX has no such tag, and the policy does not read one.
//   csv       NOWHERE. A CSV has no cleared column, which IS the policy.
//
// That asymmetry is the test: a spec can send `cleared_flag: "*"` to the CSV
// source, and both sides must still answer false.

const OFX_ONE_ROW =
  '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>GBP</CURDEF>' +
  '<BANKACCTFROM><BANKID>123456</BANKID><ACCTID>12345678</ACCTID>' +
  '<ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM><BANKTRANLIST>' +
  '<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260201</DTPOSTED>' +
  '<TRNAMT>-12.34</TRNAMT><FITID>F1</FITID><NAME>Fixture Shop</NAME>' +
  '</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';

const FIXTURE_ACCOUNT = {
  id: 'acc1',
  name: 'Fixture Account',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
};

async function clearedFlag(payload) {
  const flag = payload.cleared_flag ?? null;

  if (payload.source === 'qif') {
    const clearedLine = flag === null ? '' : `C${flag}\n`;
    const file = `!Type:Bank\nD01/02/2026\nT-12.34\nPFixture Shop\n${clearedLine}^\n`;
    const result = await qifImportService.importTransactions(file, 'acc1', [], {});
    return { cleared: result.transactions[0].cleared };
  }

  if (payload.source === 'ofx') {
    const result = await ofxImportService.importTransactions(
      OFX_ONE_ROW,
      [FIXTURE_ACCOUNT],
      [],
      { accountId: 'acc1' },
    );
    return { cleared: result.transactions[0].cleared };
  }

  if (payload.source === 'csv') {
    const result = await enhancedCsvImportService.importTransactions(
      'Date,Description,Amount\n2026-02-01,Fixture Shop,-12.34\n',
      [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Description', targetField: 'description' },
        { sourceColumn: 'Amount', targetField: 'amount' },
      ],
      [],
      new Map(),
      {},
    );
    return { cleared: result.items[0].cleared };
  }

  if (payload.source === 'ms_money') {
    const result = transformMsMoneyExport(
      {
        accounts: [{
          id: 1, name: 'Fixture Account', moneyType: 'bank', currencyCode: 'GBP',
          openingBalance: '0', reconstructedBalance: '0', closed: false,
          openDate: null, closeDate: null, comment: null,
        }],
        categories: [],
        payees: [],
        transactions: [{
          id: 10, accountId: 1, date: '2026-02-01', amount: '-12.34',
          categoryId: null, payeeId: null, memo: null, ref: null,
          // Money's own code, as the RawRow would carry it: text in, number
          // here, and anything that is not one of its three values is not 2.
          clearedStatus: flag === null ? 0 : Number(flag),
          linkAccountId: null, role: 'standalone',
        }],
      },
      '2026-03-01T00:00:00.000Z',
    );
    return { cleared: result.transactions[0].cleared };
  }

  // The bank feed's policy lives in SQL (`import_bank_transactions_atomic`),
  // not in TypeScript, and it already has a differential proof against
  // Postgres in the VERB lane. There is nothing here to run, and inventing a
  // constant would be asserting the harness rather than the product.
  throw new Error(
    `no TypeScript oracle for source "${payload.source}": the bank feed's cleared policy is ` +
    'enforced in SQL and is proved by verb-specs/feed-a-feed-row-arrives-unreconciled.spec.mjs',
  );
}

// ── plan_account_identifiers / plan_account_identifier_match ────────────────

const asOfx = (ofx) => ({
  accountId: ofx.account_id,
  bankId: ofx.bank_id ?? undefined,
  isCreditCardStatement: ofx.is_credit_card_statement,
});

const asAccount = (account) => ({
  id: account.id ?? '',
  name: 'Fixture Account',
  type: account.type,
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
  sortCode: account.sort_code ?? undefined,
  accountNumber: account.account_number ?? undefined,
});

function accountIdentifiers(payload) {
  const ofx = asOfx(payload.ofx);
  const values = readOfxAccountIdentifiers(ofx);
  const backfill = payload.account
    ? planAccountDetailsBackfill(ofx, asAccount(payload.account))
    : null;
  return {
    values: {
      sort_code: values.sortCode ?? null,
      account_number: values.accountNumber ?? null,
      card_last_four: values.cardLastFour ?? null,
    },
    backfill: backfill
      ? {
          updates: {
            sort_code: backfill.updates.sortCode ?? null,
            account_number: backfill.updates.accountNumber ?? null,
          },
          summary: backfill.summary,
        }
      : null,
  };
}

function accountIdentifierMatch(payload) {
  const found = findAccountByOfxIdentifiers(
    asOfx(payload.ofx),
    payload.accounts.map(asAccount),
  );
  // No `candidates` here: the TypeScript answers with the account or with
  // null and never says how many fitted. The port's count is declared
  // `rustOnly` by the specs rather than reconstructed in this file.
  return { account_id: found ? found.id : null };
}

// ── plan_category_admission ─────────────────────────────────────────────────

function categoryAdmission(payload) {
  const selfTransfer = isSelfTransferCategory(
    payload.categories.map((category) => ({
      id: category.id,
      isTransferCategory: category.is_transfer_category ?? false,
      accountId: category.account_id ?? undefined,
    })),
    payload.category_id ?? '',
    payload.account_id ?? '',
  );
  return { admitted: !selfTransfer, refusal: selfTransfer ? 'self_transfer' : null };
}

// ── The one entry point ─────────────────────────────────────────────────────

const VERBS = {
  plan_statement_duplicates: statementDuplicates,
  plan_statement_bank_balance: statementBankBalance,
  plan_feed_overlap: feedOverlap,
  plan_cleared_flag: clearedFlag,
  plan_account_identifiers: accountIdentifiers,
  plan_account_identifier_match: accountIdentifierMatch,
  plan_category_admission: categoryAdmission,
};

/** Answer one command with the real TypeScript. */
export async function answer(verb, payload) {
  const implementation = VERBS[verb];
  if (!implementation) {
    throw new Error(`no TypeScript oracle for verb "${verb}"`);
  }
  return { ok: true, result: await implementation(payload) };
}

/** Which verbs this oracle can answer — the runner refuses a spec outside it. */
export const ORACLE_VERBS = Object.keys(VERBS);
