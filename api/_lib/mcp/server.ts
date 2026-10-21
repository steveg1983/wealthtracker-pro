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
import { isAwaitingReview } from '../../../src/utils/transactionReview.js';
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
] as const;
