/**
 * The Reckley MCP server — the tools Claude is given over one person's ledger.
 *
 * Built fresh for every HTTP request by `createMcpHandler` (see route.ts), so
 * nothing here outlives a call: the port it reads through is scoped to the
 * caller, and the tools it registers are chosen by the scopes the caller's
 * token carries. A read-only token is never shown a write tool, not merely
 * refused one.
 *
 * ── WHAT A TOOL PROMISES ────────────────────────────────────────────────────
 * Every tool has a `title`, a description that says when to use it and when
 * to use a sibling instead, and the annotation Anthropic's review reads for
 * its auto-permission: `readOnlyHint` here. Money is a string with its
 * currency, dates are YYYY-MM-DD, lists are paginated with `limit`/`offset`
 * and capped by CHARACTER_LIMIT — fewer rows, never a cut row — with
 * `next_offset` pointing at the first row left out. Descriptions and notes
 * come from banks and files and are returned as data, nothing more.
 *
 * ── THE ARITHMETIC IS THE APP'S ─────────────────────────────────────────────
 * Spending by category goes through `computeIncomeExpense` — the function
 * the reports call — so a figure Claude quotes is the figure the screen
 * shows. Budget status joins once the shared budget evaluation lands on main
 * (it is in the dashboard batch). See docs/mcp-connector.md.
 *
 * ── NOTHING HERE IS A TYPESCRIPT ENUM OR A PARAMETER PROPERTY ──────────────
 * The API project compiles with `erasableSyntaxOnly`: the runtime is Node
 * stripping types, so the file may use only syntax that strips to nothing.
 */

import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { Category, Transaction } from '../../../src/types/index.js';
import { computeIncomeExpense } from '../../../src/utils/incomeExpense.js';
import { bucketByCategoryDirection } from '../../../src/utils/categoryNetting.js';
import { expandSplitTransactions } from '../../../src/utils/transactionSplits.js';
import { FALLBACK_BANK_DESCRIPTION, normalizePayee } from '../../../src/utils/payeeAutoCategorize.js';
import { isAwaitingReview, isUnfiled } from '../../../src/utils/transactionReview.js';
import { toDecimal } from '../../../src/utils/decimal.js';
import type { PortAccount, ReckleyPort, ReviewFilter } from './port.js';

export const READ_SCOPE = 'reckley:read';
export const WRITE_SCOPE = 'reckley:write';

/** Which listing a request arrived through; the read listing never carries the write scope. */
export type Listing = 'read' | 'full';

/** The scopes each listing advertises and asks Claude to request. */
export const LISTING_SCOPES: Record<Listing, readonly string[]> = {
  read: [READ_SCOPE],
  full: [READ_SCOPE, WRITE_SCOPE],
};

export const SERVER_NAME = 'reckley-mcp-server';
export const SERVER_VERSION = '0.1.0';

/** A tool result longer than this is answered with fewer rows (never a cut row). */
export const CHARACTER_LIMIT = 25_000;

/** Rows an aggregate will read before it says the answer is partial. */
const AGGREGATE_ROW_CAP = 20_000;

/** Rows the review queue will read before it says the count is partial. */
const REVIEW_QUEUE_CAP = 5_000;

/** The register's own payee identity: the description upper-cased and trimmed; the feed's placeholder is no payee at all. */
const payeeKey = (description: string): string | null => {
  const key = normalizePayee(description);
  return key === '' || key === FALLBACK_BANK_DESCRIPTION ? null : key;
};

/** A code-point order for strings a model reads; the app's locale comparer sits behind a browser-only seam. */
const byCodePoint = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

export interface ReckleyServerOptions {
  port: ReckleyPort;
  /** The scopes on the caller's token; decides which tools exist. */
  scopes: readonly string[];
  /** The evaluation instant, injectable so a spec can hold the calendar still. */
  now?: () => Date;
}

const ResponseFormat = {
  MARKDOWN: 'markdown',
  JSON: 'json',
} as const;

const responseFormat = z
  .enum([ResponseFormat.MARKDOWN, ResponseFormat.JSON])
  .default(ResponseFormat.MARKDOWN)
  .describe("'markdown' for readable text, 'json' for structured data");

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .describe('A calendar day, YYYY-MM-DD');

const dayOf = (date: Date | string): string =>
  (typeof date === 'string' ? new Date(date) : date).toISOString().slice(0, 10);

/** "-12.34 GBP": a signed magnitude and the currency code, nothing a locale could misread. */
export const money = (amount: number, currency: string): string => {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${Math.abs(amount).toFixed(2)} ${currency}`;
};

/**
 * Stay under CHARACTER_LIMIT by halving the page until the rendered text
 * fits. `next_offset` then names the first row left out, and the JSON text
 * still matches `structuredContent` because both come from the same render.
 */
function fitPage<T, R extends { text: string }>(items: T[], render: (page: T[]) => R): R {
  let page = items;
  let result = render(page);
  while (page.length > 1 && result.text.length > CHARACTER_LIMIT) {
    page = page.slice(0, Math.ceil(page.length / 2));
    result = render(page);
  }
  return result;
}

interface Lookups {
  accounts: Map<string, PortAccount>;
  categories: Map<string, Category>;
}

/** "Bills (Household) > Telephone" — the path a category reads as on screen. */
function categoryPath(id: string | undefined, categories: Map<string, Category>): string | null {
  if (!id) return null;
  const parts: string[] = [];
  let current = categories.get(id);
  let guard = 0;
  while (current && guard++ < 6) {
    if (current.level !== 'type') parts.unshift(current.name);
    current = current.parentId ? categories.get(current.parentId) : undefined;
  }
  return parts.length > 0 ? parts.join(' > ') : (categories.get(id)?.name ?? null);
}

/** One row as the tools report it, in both formats. */
function describeRow(row: Transaction, lookups: Lookups) {
  const account = lookups.accounts.get(row.accountId);
  const currency = account?.currency ?? 'GBP';
  const category = lookups.categories.get(row.category);
  return {
    id: row.id,
    date: dayOf(row.date),
    account_id: row.accountId,
    account: account?.name ?? row.accountId,
    description: row.description,
    amount: money(row.amount, currency),
    type: row.type,
    category_id: row.category || null,
    category: row.type === 'transfer'
      ? `Transfer with ${lookups.accounts.get(row.transferAccountId ?? '')?.name ?? 'another account'}`
      : categoryPath(row.category, lookups.categories),
    category_is_suggested: row.type !== 'transfer' && row.isSplit !== true && !!row.category && row.categoryConfirmed === false,
    is_split: row.isSplit === true,
    awaiting_review: isAwaitingReview(row),
    cleared: row.cleared === true,
    notes: row.notes ?? null,
    ...(category?.isTransferCategory ? { transfer_account_id: category.accountId ?? null } : {}),
  };
}

type DescribedRow = ReturnType<typeof describeRow>;

function rowLine(row: DescribedRow): string {
  const flags = [
    row.awaiting_review ? 'awaiting review' : null,
    row.category_is_suggested ? 'category suggested' : null,
    row.cleared ? 'cleared' : null,
    row.is_split ? 'split' : null,
  ].filter((flag): flag is string => flag !== null);
  const filed = row.category ?? 'no category';
  return `- ${row.date} · ${row.account} · ${row.description} · ${row.amount} · ${filed}` +
    (flags.length > 0 ? ` · ${flags.join(', ')}` : '') +
    ` · id ${row.id}`;
}

/**
 * Build the server for one caller. Called once per request by the handler.
 */
export function createReckleyServer(options: ReckleyServerOptions): McpServer {
  const { port } = options;
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  const lookups = async (): Promise<Lookups> => {
    const [accounts, categories] = await Promise.all([port.listAccounts(), port.listCategories()]);
    return {
      accounts: new Map(accounts.map(account => [account.id, account])),
      categories: new Map(categories.map(category => [category.id, category])),
    };
  };

  // ── Read tools: every listing ────────────────────────────────────────────

  server.registerTool(
    'reckley_list_accounts',
    {
      title: 'List accounts',
      description: `List the person's accounts with today's balance.

Returns each account's id, name, kind (checking, savings, credit, cash, investment, loan, assets, other), currency, the balance the register shows (opening balance plus every transaction), and what the bank last reported where a feed or statement said. Closed accounts are left out unless include_closed is true.

Use this first to learn account ids for reckley_search_transactions.`,
      inputSchema: z.strictObject({
        include_closed: z.boolean().default(false).describe('Also list accounts that have been closed'),
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ include_closed, response_format }) => {
      const all = await port.listAccounts();
      const accounts = all.filter(account => include_closed || account.isActive);
      const described = accounts.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balance: money(account.balance, account.currency),
        bank_balance: account.bankBalance === null ? null : money(account.bankBalance, account.currency),
        bank_balance_date: account.bankBalanceDate,
        last_reconciled: account.lastReconciledDate,
        institution: account.institution,
        closed: !account.isActive,
      }));
      const page = { count: described.length, accounts: described };
      if (response_format === ResponseFormat.JSON) {
        return { content: [{ type: 'text', text: JSON.stringify(page, null, 2) }], structuredContent: page };
      }
      if (described.length === 0) {
        return { content: [{ type: 'text', text: 'No accounts yet.' }] };
      }
      const lines = ['# Accounts', ''];
      for (const account of described) {
        lines.push(
          `- ${account.name} (${account.type}${account.closed ? ', closed' : ''}) · ${account.balance}` +
            (account.bank_balance ? ` · bank says ${account.bank_balance} as of ${account.bank_balance_date ?? 'an unknown date'}` : '') +
            ` · id ${account.id}`
        );
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  server.registerTool(
    'reckley_search_transactions',
    {
      title: 'Search transactions',
      description: `Search the person's transactions, newest first, one page at a time.

Filter by words in the description, account, category, a date range, an amount range (signed: spending is negative, so min_amount=-50 and max_amount=-10 finds spending between 10 and 50), whether the row is awaiting review, and whether it is cleared. Every filter is optional; with none, this lists recent transactions.

Each row carries its id, date, account, description, signed amount with currency, category (or "no category"), whether the category is only the app's suggestion, whether it is awaiting review, cleared, split, and any note. When more rows match than fit, the result says so and gives next_offset; call again with that offset.

Use reckley_get_transaction for one row's full detail, and reckley_spending_by_category for totals rather than rows.`,
      inputSchema: z.strictObject({
        text: z.string().max(200).optional().describe('Words to find in the description, any case'),
        account_id: z.string().optional().describe('Only this account (an id from reckley_list_accounts)'),
        category_id: z.string().optional().describe('Only rows filed under this category id (from reckley_list_categories)'),
        from: isoDay.optional().describe('Earliest date, inclusive, YYYY-MM-DD'),
        to: isoDay.optional().describe('Latest date, inclusive, YYYY-MM-DD'),
        min_amount: z.number().optional().describe('Lowest signed amount to include; spending is negative'),
        max_amount: z.number().optional().describe('Highest signed amount to include'),
        review: z.enum(['awaiting', 'done', 'any']).default('any')
          .describe("'awaiting' for rows still to be reviewed (flagged, or with no category), 'done' for the rest"),
        cleared: z.boolean().optional().describe('Only cleared rows (true) or only uncleared rows (false)'),
        include_archived: z.boolean().default(false).describe('Also search rows the person has archived'),
        limit: z.number().int().min(1).max(100).default(25).describe('Rows per page'),
        offset: z.number().int().min(0).default(0).describe('Rows to skip, for the next page'),
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      if (args.from && args.to && args.from > args.to) {
        return { content: [{ type: 'text', text: `from (${args.from}) is after to (${args.to}); swap them.` }], isError: true };
      }
      const [{ rows, total }, look] = await Promise.all([
        port.searchTransactions(
          {
            text: args.text,
            accountId: args.account_id,
            categoryId: args.category_id,
            from: args.from,
            to: args.to,
            minAmount: args.min_amount,
            maxAmount: args.max_amount,
            review: args.review as ReviewFilter,
            cleared: args.cleared,
            includeArchived: args.include_archived,
          },
          { limit: args.limit, offset: args.offset }
        ),
        lookups(),
      ]);
      const described = rows.map(row => describeRow(row, look));

      const render = (page: DescribedRow[]) => {
        const nextOffset = args.offset + page.length;
        const hasMore = total > nextOffset;
        const body = {
          total,
          count: page.length,
          offset: args.offset,
          transactions: page,
          has_more: hasMore,
          ...(hasMore ? { next_offset: nextOffset } : {}),
        };
        if (args.response_format === ResponseFormat.JSON) {
          return { body, text: JSON.stringify(body, null, 2) };
        }
        const lines = [`# Transactions`, `Showing ${page.length} of ${total}.`, ''];
        lines.push(...page.map(rowLine));
        if (hasMore) lines.push('', `More results: call again with offset=${nextOffset}.`);
        return { body, text: lines.join('\n') };
      };

      const result = fitPage(described, render);
      if (args.response_format === ResponseFormat.JSON) {
        return { content: [{ type: 'text', text: result.text }], structuredContent: result.body };
      }
      if (described.length === 0) {
        return { content: [{ type: 'text', text: 'No transactions match. Loosen a filter, or widen the dates.' }] };
      }
      return { content: [{ type: 'text', text: result.text }] };
    }
  );

  server.registerTool(
    'reckley_get_transaction',
    {
      title: 'Get a transaction',
      description: `One transaction in full, by id: every field reckley_search_transactions shows, plus its split lines (each with its own category and amount) and, for a transfer, the other account.`,
      inputSchema: z.strictObject({
        id: z.string().min(1).describe('The transaction id, from reckley_search_transactions'),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const [detail, look] = await Promise.all([port.getTransaction(id), lookups()]);
      if (!detail) {
        return { content: [{ type: 'text', text: `No transaction has id ${id}. Find ids with reckley_search_transactions.` }], isError: true };
      }
      const currency = look.accounts.get(detail.transaction.accountId)?.currency ?? 'GBP';
      const body = {
        ...describeRow(detail.transaction, look),
        splits: detail.splits.map(line => ({
          id: line.id,
          category_id: line.category,
          category: categoryPath(line.category, look.categories),
          amount: money(line.amount, currency),
          memo: line.memo ?? null,
        })),
        linked_transfer_id: detail.transaction.linkedTransferId ?? null,
      };
      return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body };
    }
  );

  server.registerTool(
    'reckley_list_categories',
    {
      title: 'List categories',
      description: `The person's category tree: every category with its id, name, full path ("Bills (Household) > Telephone"), kind (income, expense, or both), level, and whether it is a transfer category that stands for an account. Use the ids to filter reckley_search_transactions or to name a category exactly.`,
      inputSchema: z.strictObject({
        include_inactive: z.boolean().default(false).describe('Also list categories that have been retired'),
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ include_inactive, response_format }) => {
      const all = await port.listCategories();
      const byId = new Map(all.map(category => [category.id, category]));
      const categories = all
        .filter(category => include_inactive || category.isActive !== false)
        .map(category => ({
          id: category.id,
          name: category.name,
          path: categoryPath(category.id, byId) ?? category.name,
          kind: category.type,
          level: category.level,
          parent_id: category.parentId ?? null,
          transfer_account_id: category.isTransferCategory ? (category.accountId ?? null) : null,
          revaluation: category.isRevaluationCategory === true,
        }))
        // A code-point order: the list is read by a model, and the app's
        // locale-aware comparer lives behind a browser-only seam.
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      const body = { count: categories.length, categories };
      if (response_format === ResponseFormat.JSON) {
        return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body };
      }
      const lines = ['# Categories', ''];
      lines.push(...categories.map(category =>
        `- ${category.path} (${category.kind}${category.transfer_account_id ? ', transfer' : ''}) · id ${category.id}`
      ));
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  server.registerTool(
    'reckley_spending_by_category',
    {
      title: 'Spending by category',
      description: `Total spending per category over a date range, biggest first, with income and the net for the same days.

Uses the same arithmetic as the app's reports: refunds filed to a category reduce its spend, transfers between the person's own accounts are not spending, and rows with no category are counted separately and reported as such.

Give from and to as YYYY-MM-DD, inclusive. For individual rows use reckley_search_transactions.`,
      inputSchema: z.strictObject({
        from: isoDay,
        to: isoDay,
        account_id: z.string().optional().describe('Only this account'),
        limit: z.number().int().min(1).max(200).default(30).describe('Categories to list'),
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ from, to, account_id, limit, response_format }) => {
      if (from > to) {
        return { content: [{ type: 'text', text: `from (${from}) is after to (${to}); swap them.` }], isError: true };
      }
      const [range, look, categories] = await Promise.all([
        port.transactionsBetween(from, to, AGGREGATE_ROW_CAP),
        lookups(),
        port.listCategories(),
      ]);
      const rows = account_id ? range.rows.filter(row => row.accountId === account_id) : range.rows;
      const flows = computeIncomeExpense(rows, range.splits, categories);
      const currency = account_id
        ? (look.accounts.get(account_id)?.currency ?? 'GBP')
        : (look.accounts.values().next().value?.currency ?? 'GBP');

      const totals = new Map<string, ReturnType<typeof toDecimal>>();
      for (const row of flows.expenseRows) {
        totals.set(row.category, (totals.get(row.category) ?? toDecimal(0)).minus(toDecimal(row.amount)));
      }
      const listed = Array.from(totals, ([categoryId, spent]) => ({
        category_id: categoryId,
        category: categoryPath(categoryId, look.categories) ?? categoryId,
        spent,
      }))
        .filter(entry => !entry.spent.isZero())
        .sort((a, b) => b.spent.comparedTo(a.spent))
        .slice(0, limit);
      const expenses = flows.expenses;
      const body = {
        from,
        to,
        currency,
        income: money(flows.income.toNumber(), currency),
        expenses: money(expenses.toNumber(), currency),
        net: money(flows.income.minus(expenses).toNumber(), currency),
        uncategorised_rows: flows.uncategorizedRows.length,
        categories: listed.map(entry => ({
          category_id: entry.category_id,
          category: entry.category,
          spent: money(entry.spent.toNumber(), currency),
          share: expenses.isZero() ? 0 : Number(entry.spent.dividedBy(expenses).times(100).toFixed(1)),
        })),
        ...(range.capped ? { partial: `Only the first ${AGGREGATE_ROW_CAP} rows in the range were read; narrow the dates for exact totals.` } : {}),
      };
      if (response_format === ResponseFormat.JSON) {
        return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body };
      }
      const lines = [
        `# Spending ${from} to ${to}`,
        `Income ${body.income} · Spending ${body.expenses} · Net ${body.net}` +
          (body.uncategorised_rows > 0 ? ` · ${body.uncategorised_rows} rows with no category are not in these totals` : ''),
        '',
      ];
      lines.push(...body.categories.map(entry => `- ${entry.category}: ${entry.spent} (${entry.share}%)`));
      if (body.categories.length === 0) lines.push('No spending in this range.');
      if (body.partial) lines.push('', body.partial);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  server.registerTool(
    'reckley_income_vs_expenses',
    {
      title: 'Income vs expenses by month',
      description: `Income, spending and the net for each calendar month in a date range, plus the totals.

The same rule as the app's Income vs Expenses chart: a row counts by its category's direction, so a refund filed to a spending category reduces that month's spending; transfers between the person's own accounts and revaluations are not counted; rows with no category are left out of the totals and counted separately.

Give from and to as YYYY-MM-DD, inclusive. For the categories behind a month use reckley_spending_by_category; for the rows use reckley_search_transactions.`,
      inputSchema: z.strictObject({
        from: isoDay,
        to: isoDay,
        account_id: z.string().optional().describe('Only this account'),
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ from, to, account_id, response_format }) => {
      if (from > to) {
        return { content: [{ type: 'text', text: `from (${from}) is after to (${to}); swap them.` }], isError: true };
      }
      const [range, look] = await Promise.all([
        port.transactionsBetween(from, to, AGGREGATE_ROW_CAP),
        lookups(),
      ]);
      const rows = expandSplitTransactions(
        account_id ? range.rows.filter(row => row.accountId === account_id) : range.rows,
        range.splits
      );
      const currency = account_id
        ? (look.accounts.get(account_id)?.currency ?? 'GBP')
        : (look.accounts.values().next().value?.currency ?? 'GBP');
      const byMonth = new Map<string, { income: ReturnType<typeof toDecimal>; expenses: ReturnType<typeof toDecimal> }>();
      let uncategorised = 0;
      for (const row of rows) {
        const bucket = bucketByCategoryDirection(row, look.categories);
        if (bucket === 'uncategorized') { uncategorised += 1; continue; }
        if (bucket !== 'income' && bucket !== 'expense') continue;
        const key = dayOf(row.date).slice(0, 7);
        const month = byMonth.get(key) ?? { income: toDecimal(0), expenses: toDecimal(0) };
        if (bucket === 'income') month.income = month.income.plus(toDecimal(row.amount));
        else month.expenses = month.expenses.minus(toDecimal(row.amount));
        byMonth.set(key, month);
      }
      const months = Array.from(byMonth.entries()).sort(([a], [b]) => byCodePoint(a, b)).map(([key, month]) => ({
        month: key,
        income: money(month.income.toNumber(), currency),
        expenses: money(month.expenses.toNumber(), currency),
        net: money(month.income.minus(month.expenses).toNumber(), currency),
      }));
      const totalIncome = Array.from(byMonth.values()).reduce((sum, m) => sum.plus(m.income), toDecimal(0));
      const totalExpenses = Array.from(byMonth.values()).reduce((sum, m) => sum.plus(m.expenses), toDecimal(0));
      const body = {
        from,
        to,
        currency,
        months,
        income: money(totalIncome.toNumber(), currency),
        expenses: money(totalExpenses.toNumber(), currency),
        net: money(totalIncome.minus(totalExpenses).toNumber(), currency),
        uncategorised_rows: uncategorised,
        ...(range.capped ? { partial: `Only the first ${AGGREGATE_ROW_CAP} rows in the range were read; narrow the dates for exact totals.` } : {}),
      };
      if (response_format === ResponseFormat.JSON) {
        return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body };
      }
      const lines = [
        `# Income vs expenses ${from} to ${to}`,
        `Income ${body.income} · Spending ${body.expenses} · Net ${body.net}` +
          (uncategorised > 0 ? ` · ${uncategorised} rows with no category are not in these totals` : ''),
        '',
      ];
      lines.push(...months.map(m => `- ${m.month}: income ${m.income}, spending ${m.expenses}, net ${m.net}`));
      if (months.length === 0) lines.push('Nothing in this range.');
      if (body.partial) lines.push('', body.partial);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  server.registerTool(
    'reckley_spending_by_payee',
    {
      title: 'Spending by payee',
      description: `Who the person paid over a date range, biggest first: each payee's net spend, how many rows, the first and last dates, and the category most of its rows carry.

A payee is the description as the bank wrote it, so "NORTHGATE MARKET" and "NORTHGATE MARKET REFUND" are two payees — the refund appears as a negative spend of its own, exactly as the app's Spending by Payee report shows it. Transfers and rows with no category are not spending and are left out.

Give from and to as YYYY-MM-DD, inclusive.`,
      inputSchema: z.strictObject({
        from: isoDay,
        to: isoDay,
        account_id: z.string().optional().describe('Only this account'),
        limit: z.number().int().min(1).max(200).default(30).describe('Payees to list'),
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ from, to, account_id, limit, response_format }) => {
      if (from > to) {
        return { content: [{ type: 'text', text: `from (${from}) is after to (${to}); swap them.` }], isError: true };
      }
      const [range, look, categories] = await Promise.all([
        port.transactionsBetween(from, to, AGGREGATE_ROW_CAP),
        lookups(),
        port.listCategories(),
      ]);
      const rows = account_id ? range.rows.filter(row => row.accountId === account_id) : range.rows;
      const flows = computeIncomeExpense(rows, range.splits, categories);
      const currency = account_id
        ? (look.accounts.get(account_id)?.currency ?? 'GBP')
        : (look.accounts.values().next().value?.currency ?? 'GBP');
      interface PayeeGroup { name: string; spent: ReturnType<typeof toDecimal>; count: number; earliest: string; latest: string; categories: Map<string, number> }
      const groups = new Map<string, PayeeGroup>();
      for (const row of flows.expenseRows) {
        const key = payeeKey(row.description) ?? '(no payee)';
        const day = dayOf(row.date);
        const group = groups.get(key) ?? {
          name: key === '(no payee)' ? 'No payee recorded' : row.description.trim(),
          spent: toDecimal(0), count: 0, earliest: day, latest: day, categories: new Map(),
        };
        group.spent = group.spent.minus(toDecimal(row.amount));
        group.count += 1;
        if (day < group.earliest) group.earliest = day;
        if (day > group.latest) group.latest = day;
        if (row.category) group.categories.set(row.category, (group.categories.get(row.category) ?? 0) + 1);
        groups.set(key, group);
      }
      const total = flows.expenses;
      const listed = Array.from(groups.values())
        .sort((a, b) => b.spent.comparedTo(a.spent) || byCodePoint(a.name, b.name))
        .slice(0, limit)
        .map(group => {
          const top = Array.from(group.categories.entries()).sort((a, b) => b[1] - a[1])[0];
          return {
            payee: group.name,
            spent: money(group.spent.toNumber(), currency),
            rows: group.count,
            first: group.earliest,
            last: group.latest,
            share: total.isZero() ? 0 : Number(group.spent.dividedBy(total).times(100).toFixed(1)),
            usual_category: top ? categoryPath(top[0], look.categories) : null,
          };
        });
      const body = {
        from,
        to,
        currency,
        expenses: money(total.toNumber(), currency),
        payees: listed,
        ...(range.capped ? { partial: `Only the first ${AGGREGATE_ROW_CAP} rows in the range were read; narrow the dates for exact totals.` } : {}),
      };
      if (response_format === ResponseFormat.JSON) {
        return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body };
      }
      const lines = [`# Spending by payee ${from} to ${to}`, `Spending ${body.expenses}`, ''];
      lines.push(...listed.map(p => `- ${p.payee}: ${p.spent} over ${p.rows} rows (${p.share}%)${p.usual_category ? `, usually ${p.usual_category}` : ''}`));
      if (listed.length === 0) lines.push('No spending in this range.');
      if (body.partial) lines.push('', body.partial);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  server.registerTool(
    'reckley_net_worth',
    {
      title: 'Net worth today',
      description: `What the person owns and owes today, from the register: assets are the accounts with a positive balance, liabilities the size of the negative ones, net worth the difference — the Dashboard's rule — reported per currency, since this tool converts nothing.

Ledger figures only: an investment account counts at the value its register carries, not at today's prices, and closed accounts are left out. For the balances behind these totals use reckley_list_accounts.`,
      inputSchema: z.strictObject({
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ response_format }) => {
      const accounts = (await port.listAccounts()).filter(account => account.isActive);
      interface Side { assets: ReturnType<typeof toDecimal>; liabilities: ReturnType<typeof toDecimal>; counted: number }
      const byCurrency = new Map<string, Side>();
      for (const account of accounts) {
        const amount = toDecimal(account.balance);
        if (amount.isZero()) continue;
        const side = byCurrency.get(account.currency) ?? { assets: toDecimal(0), liabilities: toDecimal(0), counted: 0 };
        if (amount.isNegative()) side.liabilities = side.liabilities.plus(amount.abs());
        else side.assets = side.assets.plus(amount);
        side.counted += 1;
        byCurrency.set(account.currency, side);
      }
      const currencies = Array.from(byCurrency.entries()).sort(([a], [b]) => byCodePoint(a, b)).map(([currency, side]) => ({
        currency,
        assets: money(side.assets.toNumber(), currency),
        liabilities: money(side.liabilities.toNumber(), currency),
        net_worth: money(side.assets.minus(side.liabilities).toNumber(), currency),
        accounts_counted: side.counted,
      }));
      const body = { as_of: dayOf(new Date()), open_accounts: accounts.length, currencies };
      if (response_format === ResponseFormat.JSON) {
        return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body };
      }
      const lines = [`# Net worth as of ${body.as_of}`, ''];
      lines.push(...currencies.map(c => `- ${c.currency}: own ${c.assets}, owe ${c.liabilities}, net ${c.net_worth} (${c.accounts_counted} accounts)`));
      if (currencies.length === 0) lines.push('No open accounts with a balance.');
      lines.push('', 'Register figures: investments at their ledger value, no currency conversion, closed accounts excluded.');
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  server.registerTool(
    'reckley_review_queue',
    {
      title: 'What is waiting for review',
      description: `The rows the app's To Review list holds, counted by account: how many, how many carry only the app's suggested category, how many have no category at all, and the oldest and newest dates. The same rule as the register: a row is awaiting review when it is flagged, or when it has no category and is neither a transfer nor a split.

Use reckley_search_transactions with review='awaiting' and an account_id for the rows themselves.`,
      inputSchema: z.strictObject({
        response_format: responseFormat,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ response_format }) => {
      const [queue, look] = await Promise.all([port.reviewQueue(REVIEW_QUEUE_CAP), lookups()]);
      interface Tally { count: number; suggested: number; unfiled: number; oldest: string; newest: string }
      const byAccount = new Map<string, Tally>();
      for (const row of queue.rows) {
        const day = dayOf(row.date);
        const tally = byAccount.get(row.accountId) ?? { count: 0, suggested: 0, unfiled: 0, oldest: day, newest: day };
        tally.count += 1;
        if (row.category && row.categoryConfirmed === false) tally.suggested += 1;
        if (isUnfiled(row)) tally.unfiled += 1;
        if (day < tally.oldest) tally.oldest = day;
        if (day > tally.newest) tally.newest = day;
        byAccount.set(row.accountId, tally);
      }
      const accounts = Array.from(byAccount.entries())
        .map(([accountId, tally]) => ({ account_id: accountId, account: look.accounts.get(accountId)?.name ?? accountId, ...tally }))
        .sort((a, b) => b.count - a.count || byCodePoint(a.account, b.account));
      const body = {
        total: queue.rows.length,
        accounts,
        ...(queue.capped ? { partial: `Only the first ${REVIEW_QUEUE_CAP} rows were counted.` } : {}),
      };
      if (response_format === ResponseFormat.JSON) {
        return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], structuredContent: body };
      }
      if (accounts.length === 0) {
        return { content: [{ type: 'text', text: 'Nothing is waiting for review.' }] };
      }
      const lines = [`# To review: ${body.total} rows`, ''];
      lines.push(...accounts.map(a =>
        `- ${a.account}: ${a.count} rows (${a.suggested} with a suggested category, ${a.unfiled} with none), ${a.oldest} to ${a.newest} · account id ${a.account_id}`
      ));
      if (body.partial) lines.push('', body.partial);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // Write tools arrive in the next slice; a token without the write scope will
  // never see them, because they are registered here only when it has it.

  return server;
}

/** The names the read listing registers, for the specs and the listing page. */
export const READ_TOOL_NAMES = [
  'reckley_list_accounts',
  'reckley_search_transactions',
  'reckley_get_transaction',
  'reckley_list_categories',
  'reckley_spending_by_category',
  'reckley_income_vs_expenses',
  'reckley_spending_by_payee',
  'reckley_net_worth',
  'reckley_review_queue',
] as const;
