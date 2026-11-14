/**
 * The ledger, as tools Claude can call from the in-app assistant: the Claude
 * connector's READ tools, reached in-process.
 *
 * ── ONE SET OF TOOLS, TWO DOORS ─────────────────────────────────────────────
 * The connector (docs/mcp-connector.md) already answers "what did we spend on
 * eating out", "how are the budgets doing", "what is my net worth" — through
 * the app's own arithmetic, scoped to one ledger, evaluated 10/10 in October.
 * Writing those answers a second time for the Ask panel would be a second
 * place for a figure to drift from the screen. So the assistant builds the
 * very same server, over the very same port, and talks to it with a real MCP
 * client whose fetch never leaves the function: `createMcpHandler(...).fetch`
 * answers it in memory, exactly as the connector's own specs drive it.
 *
 * ── READ ONLY, WHATEVER HAPPENS ─────────────────────────────────────────────
 * The server is built with READ_SCOPE alone, so the write tools are not
 * refused here, they do not exist. Nothing a question says can make the
 * assistant change the ledger.
 *
 * ── THE PORT IS THE ONLY USER ID ────────────────────────────────────────────
 * The caller hands in a port already scoped to the signed-in person (the
 * route builds it from the verified session); no tool argument can name a
 * user, so no question can read another person's money.
 */

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { ReckleyPort } from '../mcp/port.js';
import { READ_SCOPE, createReckleyServer } from '../mcp/server.js';

/** A tool as the Messages API is given it. */
export interface LedgerToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; [key: string]: unknown };
}

export interface LedgerToolResult {
  text: string;
  isError: boolean;
}

export interface LedgerTools {
  definitions: LedgerToolDefinition[];
  call: (name: string, input: unknown) => Promise<LedgerToolResult>;
  close: () => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The text of a tool's answer, whatever blocks it came in. */
const textOf = (content: unknown): string => {
  if (!Array.isArray(content)) return '';
  return content
    .map(block => (isRecord(block) && typeof block.text === 'string' ? block.text : ''))
    .filter(text => text !== '')
    .join('\n');
};

/** Open the read tools over one person's ledger. Close it when the question is answered. */
export async function openLedgerTools(port: ReckleyPort, now?: () => Date): Promise<LedgerTools> {
  const handler = createMcpHandler(() => createReckleyServer({ port, scopes: [READ_SCOPE], now }));
  const transport = new StreamableHTTPClientTransport(new URL('http://assistant.internal/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });
  const client = new Client({ name: 'reckley-assistant', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  await client.connect(transport);

  const listed = await client.listTools();
  const definitions: LedgerToolDefinition[] = listed.tools.map(tool => ({
    name: tool.name,
    description: tool.description ?? tool.title ?? tool.name,
    input_schema: { ...tool.inputSchema, type: 'object' },
  }));
  const known = new Set(definitions.map(tool => tool.name));

  return {
    definitions,
    call: async (name, input) => {
      if (!known.has(name)) {
        return { text: `There is no tool called ${name}.`, isError: true };
      }
      try {
        const result = await client.callTool({ name, arguments: isRecord(input) ? input : {} });
        return { text: textOf(result.content) || '(no result)', isError: result.isError === true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'the tool failed';
        return { text: `The tool failed: ${message}`, isError: true };
      }
    },
    close: async () => {
      await client.close();
      await handler.close();
    },
  };
}
