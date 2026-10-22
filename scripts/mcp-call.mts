/**
 * Call one connector tool over Streamable HTTP and print what came back —
 * the exploration companion to scripts/mcp-local.mts.
 *
 * Usage:
 *   npx tsx scripts/mcp-call.mts <url> list
 *   npx tsx scripts/mcp-call.mts <url> <tool> '<json arguments>'
 *
 * Prints the text content as the model would read it; with --json, the
 * structured content instead.
 */

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const [url, tool, rawArgs, ...rest] = process.argv.slice(2);
if (!url || !tool) {
  console.error("usage: mcp-call.mts <url> list | <tool> '<json>' [--json]");
  process.exit(1);
}
const wantJson = rest.includes('--json') || rawArgs === '--json';

const client = new Client({ name: 'mcp-call', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

if (tool === 'list') {
  const { tools } = await client.listTools();
  for (const entry of tools) console.log(`${entry.name} — ${entry.title ?? ''}`);
} else {
  const args = rawArgs && rawArgs !== '--json' ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  const result = (await client.callTool({ name: tool, arguments: args })) as {
    isError?: boolean;
    content: { type: string; text?: string }[];
    structuredContent?: unknown;
  };
  if (wantJson && result.structuredContent !== undefined) {
    console.log(JSON.stringify(result.structuredContent, null, 2));
  } else {
    console.log(result.content.map(block => block.text ?? '').join('\n'));
  }
  if (result.isError) process.exitCode = 2;
}
await client.close();
