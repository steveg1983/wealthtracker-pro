/**
 * THE ASSISTANT'S TOOLS ARE THE CONNECTOR'S READ TOOLS, reached in-process by
 * a real MCP client over the in-memory fake ledger. No write tool exists.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { openLedgerTools, type LedgerTools } from '../../../../api/_lib/assistant/ledgerTools';
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES } from '../../../../api/_lib/mcp/server';
import { fakePort } from '../mcp/fakePort';

let tools: LedgerTools | null = null;

afterEach(async () => {
  await tools?.close();
  tools = null;
});

describe('the in-app assistant’s ledger tools', () => {
  it('are exactly the connector’s read tools, each with a description and an object schema', async () => {
    tools = await openLedgerTools(fakePort());
    const names = tools.definitions.map(tool => tool.name).sort();
    expect(names).toEqual([...READ_TOOL_NAMES].sort());
    for (const tool of tools.definitions) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.input_schema.type).toBe('object');
    }
  });

  it('never include a write tool, so nothing a question says can change the ledger', async () => {
    tools = await openLedgerTools(fakePort());
    const names = new Set(tools.definitions.map(tool => tool.name));
    for (const write of WRITE_TOOL_NAMES) expect(names.has(write)).toBe(false);
    const refused = await tools.call('reckley_set_category', { transaction_ids: ['t-1'], category_id: 'det-fuel' });
    expect(refused.isError).toBe(true);
  });

  it('answer from the ledger they were opened over', async () => {
    tools = await openLedgerTools(fakePort());
    const result = await tools.call('reckley_list_accounts', {});
    expect(result.isError).toBe(false);
    expect(result.text).toContain('Current Account');
    expect(result.text).toContain('Savings');
  });

  it('report a bad argument as a tool error, not a crash', async () => {
    tools = await openLedgerTools(fakePort());
    const result = await tools.call('reckley_get_transaction', { id: 'no-such-row' });
    expect(result.isError).toBe(true);
  });
});
