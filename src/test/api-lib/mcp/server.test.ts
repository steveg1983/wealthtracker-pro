/**
 * THE RECKLEY MCP SERVER, DRIVEN BY A REAL MCP CLIENT.
 *
 * No ports, no mocks of the protocol: `createMcpHandler` answers the client's
 * fetch in-process, so what these specs see is what Claude sees — the tool
 * list, the schemas, the wording, the pagination and the limits. The ledger
 * behind it is the in-memory port in fakePort.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import type { Transaction } from '../../../types';
import {
  CHARACTER_LIMIT,
  READ_SCOPE,
  READ_TOOL_NAMES,
  createReckleyServer,
} from '../../../../api/_lib/mcp/server';
import type { ReckleyPort } from '../../../../api/_lib/mcp/port';
import { accounts, fakePort, transactions } from './fakePort';

const NOW = new Date(2026, 9, 15, 12, 0, 0); // 15 October 2026

let handler: McpHttpHandler;
let client: Client;

async function connect(port: ReckleyPort = fakePort(), scopes: string[] = [READ_SCOPE]): Promise<Client> {
  handler = createMcpHandler(() => createReckleyServer({ port, scopes, now: () => NOW }));
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/api/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  client = new Client({ name: 'spec-harness', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  await client.connect(transport);
  return client;
}

type ToolResult = { isError?: boolean; content: { type: string; text?: string }[]; structuredContent?: unknown };

const call = async (name: string, args: Record<string, unknown> = {}): Promise<ToolResult> =>
  (await client.callTool({ name, arguments: args })) as ToolResult;

const textOf = (result: ToolResult): string => result.content.map(block => block.text ?? '').join('\n');

beforeEach(async () => {
  await connect();
});

afterEach(async () => {
  await client.close();
  await handler.close();
});

describe('the tool list', () => {
  it('is exactly the read tools, each titled and marked read-only', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name).sort()).toEqual([...READ_TOOL_NAMES].sort());
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
      expect(tool.name.length).toBeLessThanOrEqual(64);
    }
  });
});

describe('reckley_list_accounts', () => {
  it('lists open accounts with the register balance, and closed ones only when asked', async () => {
    const open = await call('reckley_list_accounts', { response_format: 'json' });
    const page = open.structuredContent as { count: number; accounts: { name: string; balance: string; closed: boolean }[] };
    expect(page.count).toBe(2);
    expect(page.accounts.map(account => account.name)).toEqual(['Current Account', 'Savings']);
    expect(page.accounts[0].balance).toBe('1234.56 GBP');
    // The JSON text is the same data.
    expect(JSON.parse(textOf(open))).toEqual(page);

    const all = await call('reckley_list_accounts', { include_closed: true, response_format: 'json' });
    expect((all.structuredContent as { count: number }).count).toBe(3);
  });

  it('reads as a list in markdown, with the bank’s figure where there is one', async () => {
    const text = textOf(await call('reckley_list_accounts'));
    expect(text).toContain('# Accounts');
    expect(text).toContain('Current Account (checking) · 1234.56 GBP · bank says 1230.00 GBP as of 2026-10-14');
    expect(text).not.toContain('Old Card');
  });
});

describe('reckley_search_transactions', () => {
  it('lists newest first with the total, in both formats', async () => {
    const json = await call('reckley_search_transactions', { response_format: 'json' });
    const page = json.structuredContent as { total: number; count: number; has_more: boolean; transactions: { id: string; date: string; amount: string; category: string | null }[] };
    expect(page.total).toBe(transactions.length);
    expect(page.has_more).toBe(false);
    expect(page.transactions[0]).toMatchObject({ id: 't8', date: '2026-10-10', amount: '-100.00 GBP' });
    expect(JSON.parse(textOf(json))).toEqual(page);

    const text = textOf(await call('reckley_search_transactions'));
    expect(text).toContain(`Showing ${transactions.length} of ${transactions.length}.`);
    expect(text).toContain('- 2026-10-03 · Current Account · Direct Debit - SKYLINE TELECOM · -30.00 GBP · Bills (Household) > Telephone · awaiting review, category suggested · id t2');
  });

  it('says which rows are awaiting review, and finds only those on request', async () => {
    const result = await call('reckley_search_transactions', { review: 'awaiting', response_format: 'json' });
    const page = result.structuredContent as { transactions: { id: string; awaiting_review: boolean }[] };
    // t2 is flagged; t6 has no category; a split parent and a transfer never count.
    expect(page.transactions.map(row => row.id).sort()).toEqual(['t2', 't6']);
    expect(page.transactions.every(row => row.awaiting_review)).toBe(true);
  });

  it('names a transfer by the account it moves money to', async () => {
    const result = await call('reckley_search_transactions', { text: 'transfer', response_format: 'json' });
    const page = result.structuredContent as { transactions: { id: string; category: string }[] };
    expect(page.transactions[0]).toMatchObject({ id: 't4', category: 'Transfer with Savings' });
  });

  it('paginates, and says where the next page starts', async () => {
    const first = await call('reckley_search_transactions', { limit: 3, response_format: 'json' });
    const page = first.structuredContent as { count: number; has_more: boolean; next_offset?: number };
    expect(page.count).toBe(3);
    expect(page.has_more).toBe(true);
    expect(page.next_offset).toBe(3);
    expect(textOf(await call('reckley_search_transactions', { limit: 3 }))).toContain('More results: call again with offset=3.');

    const last = await call('reckley_search_transactions', { limit: 3, offset: 6, response_format: 'json' });
    expect((last.structuredContent as { has_more: boolean }).has_more).toBe(false);
  });

  it('filters by amount range the signed way, and by dates', async () => {
    const spending = await call('reckley_search_transactions', { min_amount: -50, max_amount: -10, response_format: 'json' });
    const ids = (spending.structuredContent as { transactions: { id: string }[] }).transactions.map(row => row.id).sort();
    expect(ids).toEqual(['t1', 't2', 't6']);

    const october = await call('reckley_search_transactions', { from: '2026-10-01', to: '2026-10-31', text: 'northgate', response_format: 'json' });
    expect((october.structuredContent as { transactions: { id: string }[] }).transactions.map(row => row.id).sort()).toEqual(['t1', 't5']);
  });

  it('refuses a backwards date range, and an impossible page size, in words', async () => {
    const backwards = await call('reckley_search_transactions', { from: '2026-10-31', to: '2026-10-01' });
    expect(backwards.isError).toBe(true);
    expect(textOf(backwards)).toContain('swap them');

    const zero = await call('reckley_search_transactions', { limit: 0 });
    expect(zero.isError).toBe(true);
  });

  it('says so when nothing matches', async () => {
    expect(textOf(await call('reckley_search_transactions', { text: 'nothing like this' }))).toContain('No transactions match');
  });

  it('answers a long page with fewer rows, never a cut row', async () => {
    await client.close();
    await handler.close();
    const many: Transaction[] = Array.from({ length: 400 }, (_, i) => ({
      ...transactions[0],
      id: `big-${i}`,
      description: `A deliberately long description to fill the page ${'x'.repeat(120)} ${i}`,
    }));
    await connect(fakePort({ transactions: many }));

    const result = await call('reckley_search_transactions', { limit: 100, response_format: 'json' });
    const page = result.structuredContent as { count: number; total: number; has_more: boolean; next_offset?: number };
    expect(textOf(result).length).toBeLessThanOrEqual(CHARACTER_LIMIT);
    expect(page.count).toBeLessThan(100);
    expect(page.has_more).toBe(true);
    expect(page.next_offset).toBe(page.count);
    expect(page.total).toBe(400);
  });
});

describe('reckley_get_transaction', () => {
  it('returns the row with its split lines, each named by its own category', async () => {
    const result = await call('reckley_get_transaction', { id: 't8' });
    const body = result.structuredContent as { id: string; is_split: boolean; notes: string; splits: { category: string; amount: string }[] };
    expect(body).toMatchObject({ id: 't8', is_split: true, notes: 'split at the till' });
    expect(body.splits).toEqual([
      { id: 's1', category_id: 'det-groceries', category: 'Food > Groceries', amount: '-70.00 GBP', memo: null },
      { id: 's2', category_id: 'det-fuel', category: 'Fuel', amount: '-30.00 GBP', memo: null },
    ]);
  });

  it('says when no row has that id', async () => {
    const result = await call('reckley_get_transaction', { id: 'nope' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No transaction has id nope');
  });
});

describe('reckley_list_categories', () => {
  it('gives every live category its path, and leaves retired ones out unless asked', async () => {
    const result = await call('reckley_list_categories', { response_format: 'json' });
    const body = result.structuredContent as { categories: { id: string; path: string; transfer_account_id: string | null }[] };
    const phone = body.categories.find(category => category.id === 'det-phone');
    expect(phone?.path).toBe('Bills (Household) > Telephone');
    expect(body.categories.find(category => category.id === 'tofrom-savings')?.transfer_account_id).toBe('acc-savings');
    expect(body.categories.some(category => category.id === 'det-retired')).toBe(false);

    const all = await call('reckley_list_categories', { include_inactive: true, response_format: 'json' });
    expect((all.structuredContent as { categories: { id: string }[] }).categories.some(category => category.id === 'det-retired')).toBe(true);
  });
});

describe('reckley_spending_by_category', () => {
  it('totals October the way the app’s reports do: refunds net, transfers out, blanks counted apart', async () => {
    const result = await call('reckley_spending_by_category', { from: '2026-10-01', to: '2026-10-31', response_format: 'json' });
    const body = result.structuredContent as {
      income: string; expenses: string; net: string; uncategorised_rows: number;
      categories: { category: string; spent: string; share: number }[];
    };
    // Groceries: 45 shop + 70 split line − 12.50 refund = 102.50. September's 60 is outside.
    expect(body.categories[0]).toMatchObject({ category: 'Food > Groceries', spent: '102.50 GBP' });
    expect(body.categories.map(entry => entry.category)).toEqual(['Food > Groceries', 'Bills (Household) > Telephone', 'Fuel']);
    expect(body.expenses).toBe('162.50 GBP');
    expect(body.income).toBe('2000.00 GBP');
    expect(body.net).toBe('1837.50 GBP');
    // The £20 cash row has no category and is not in any total; the £500 transfer is nowhere.
    expect(body.uncategorised_rows).toBe(1);
    expect(body.categories.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(100, 0);
  });

  it('reads as a list, with the uncategorised count said beside the totals', async () => {
    const text = textOf(await call('reckley_spending_by_category', { from: '2026-10-01', to: '2026-10-31' }));
    expect(text).toContain('Income 2000.00 GBP · Spending 162.50 GBP · Net 1837.50 GBP · 1 rows with no category are not in these totals');
    expect(text).toContain('- Food > Groceries: 102.50 GBP (63.1%)');
  });

  it('refuses a backwards range', async () => {
    const result = await call('reckley_spending_by_category', { from: '2026-10-31', to: '2026-10-01' });
    expect(result.isError).toBe(true);
  });
});

describe('reckley_income_vs_expenses', () => {
  it('buckets by calendar month with the chart’s own rule, and totals the range', async () => {
    const result = await call('reckley_income_vs_expenses', { from: '2026-09-01', to: '2026-10-31', response_format: 'json' });
    const body = result.structuredContent as {
      months: { month: string; income: string; expenses: string; net: string }[];
      income: string; expenses: string; net: string; uncategorised_rows: number;
    };
    expect(body.months).toEqual([
      { month: '2026-09', income: '0.00 GBP', expenses: '60.00 GBP', net: '-60.00 GBP' },
      // October: 45 + 30 + 70 + 30 spent, 12.50 refunded; the transfer and the cash row are not counted.
      { month: '2026-10', income: '2000.00 GBP', expenses: '162.50 GBP', net: '1837.50 GBP' },
    ]);
    expect(body.expenses).toBe('222.50 GBP');
    expect(body.net).toBe('1777.50 GBP');
    expect(body.uncategorised_rows).toBe(1);
  });

  it('reads as one line per month', async () => {
    const text = textOf(await call('reckley_income_vs_expenses', { from: '2026-10-01', to: '2026-10-31' }));
    expect(text).toContain('- 2026-10: income 2000.00 GBP, spending 162.50 GBP, net 1837.50 GBP');
  });
});

describe('reckley_spending_by_payee', () => {
  it('names each payee as the bank wrote it, biggest first, with the refund as its own negative line', async () => {
    const result = await call('reckley_spending_by_payee', { from: '2026-10-01', to: '2026-10-31', response_format: 'json' });
    const body = result.structuredContent as { expenses: string; payees: { payee: string; spent: string; rows: number; share: number; usual_category: string | null }[] };
    expect(body.expenses).toBe('162.50 GBP');
    expect(body.payees.map(p => [p.payee, p.spent, p.rows])).toEqual([
      ['BIG SHOP', '100.00 GBP', 2],
      ['NORTHGATE MARKET', '45.00 GBP', 1],
      ['Direct Debit - SKYLINE TELECOM', '30.00 GBP', 1],
      ['NORTHGATE MARKET REFUND', '-12.50 GBP', 1],
    ]);
    expect(body.payees[0].usual_category).toBe('Food > Groceries');
    expect(body.payees[0].share).toBeCloseTo(61.5, 1);
  });

  it('honours the limit and reads as a list', async () => {
    const text = textOf(await call('reckley_spending_by_payee', { from: '2026-10-01', to: '2026-10-31', limit: 2 }));
    expect(text).toContain('- BIG SHOP: 100.00 GBP over 2 rows (61.5%), usually Food > Groceries');
    expect(text).not.toContain('SKYLINE');
  });
});

describe('reckley_net_worth', () => {
  it('sums positive balances as assets and negative ones as liabilities, per currency, open accounts only', async () => {
    await client.close();
    await handler.close();
    await connect(fakePort({
      accounts: [
        ...accounts,
        { id: 'acc-card', name: 'Credit Card', type: 'credit', currency: 'GBP', isActive: true, institution: null, balance: -500, bankBalance: null, bankBalanceDate: null, lastReconciledDate: null },
        { id: 'acc-eur', name: 'Euro Account', type: 'checking', currency: 'EUR', isActive: true, institution: null, balance: 250, bankBalance: null, bankBalanceDate: null, lastReconciledDate: null },
        { id: 'acc-zero', name: 'Empty', type: 'cash', currency: 'GBP', isActive: true, institution: null, balance: 0, bankBalance: null, bankBalanceDate: null, lastReconciledDate: null },
      ],
    }));

    const result = await call('reckley_net_worth', { response_format: 'json' });
    const body = result.structuredContent as { open_accounts: number; currencies: Record<string, unknown>[] };
    // The closed Old Card is not counted; the zero-balance account is neither side.
    expect(body.open_accounts).toBe(5);
    expect(body.currencies).toEqual([
      { currency: 'EUR', assets: '250.00 EUR', liabilities: '0.00 EUR', net_worth: '250.00 EUR', accounts_counted: 1 },
      { currency: 'GBP', assets: '6234.56 GBP', liabilities: '500.00 GBP', net_worth: '5734.56 GBP', accounts_counted: 3 },
    ]);
  });

  it('says what the figures are and are not', async () => {
    const text = textOf(await call('reckley_net_worth'));
    expect(text).toContain('- GBP: own 6234.56 GBP, owe 0.00 GBP, net 6234.56 GBP (2 accounts)');
    expect(text).toContain('investments at their ledger value, no currency conversion, closed accounts excluded');
  });
});

describe('reckley_review_queue', () => {
  it('counts the To Review rows by account, the suggested and the unfiled apart', async () => {
    const result = await call('reckley_review_queue', { response_format: 'json' });
    const body = result.structuredContent as { total: number; accounts: Record<string, unknown>[] };
    expect(body.total).toBe(2);
    expect(body.accounts).toEqual([
      { account_id: 'acc-current', account: 'Current Account', count: 2, suggested: 1, unfiled: 1, oldest: '2026-10-03', newest: '2026-10-09' },
    ]);
  });

  it('says so when nothing is waiting', async () => {
    await client.close();
    await handler.close();
    await connect(fakePort({ transactions: [transactions[0]] }));
    expect(textOf(await call('reckley_review_queue'))).toBe('Nothing is waiting for review.');
  });
});

describe('reckley_budget_status', () => {
  it('measures each active budget over its own period, as the Budget page does', async () => {
    const result = await call('reckley_budget_status', { response_format: 'json' });
    const body = result.structuredContent as { count: number; budgets: Record<string, unknown>[] };
    expect(body.count).toBe(1);
    expect(body.budgets[0]).toMatchObject({
      id: 'b-groceries',
      name: 'Groceries',
      period: 'Monthly',
      from: '2026-10-01',
      to: '2026-10-31',
      allowance: '150.00 GBP',
      // 45 + 70 (split line) − 12.50 refund; September's 60 is another month.
      spent: '102.50 GBP',
      remaining: '47.50 GBP',
      over_budget: false,
    });
  });

  it('says so when there are none', async () => {
    await client.close();
    await handler.close();
    await connect(fakePort({ budgets: [] }));
    expect(textOf(await call('reckley_budget_status'))).toBe('No active budgets.');
  });
});

