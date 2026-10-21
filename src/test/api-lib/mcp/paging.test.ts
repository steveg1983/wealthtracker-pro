/**
 * READING PAST POSTGREST'S ROW CAP — the loop every multi-page read uses.
 *
 * The transport clamps a select to 1,000 rows and says nothing; the first
 * balance sum the connector made stopped there and was wrong by hundreds of
 * thousands. These specs pin the loop: it keeps asking until a short page,
 * it stops at the cap and says so, and it never asks for more than the cap.
 */

import { describe, it, expect } from 'vitest';
import { readAllPages } from '../../../../api/_lib/mcp/paging';

/** A table of `total` rows served in pages, as PostgREST serves them, clamped at `clamp`. */
function table(total: number, clamp = 1000) {
  const asked: [number, number][] = [];
  const fetchPage = async (from: number, to: number): Promise<number[]> => {
    asked.push([from, to]);
    const end = Math.min(to, from + clamp - 1, total - 1);
    return from > end ? [] : Array.from({ length: end - from + 1 }, (_, i) => from + i);
  };
  return { fetchPage, asked };
}

describe('readAllPages', () => {
  it('keeps reading until a page comes back short, and returns every row once', async () => {
    const t = table(2345);
    const read = await readAllPages(t.fetchPage, 20_000);
    expect(read.rows.length).toBe(2345);
    expect(new Set(read.rows).size).toBe(2345);
    expect(read.capped).toBe(false);
    expect(t.asked).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('is not fooled by the transport clamping a wide range to a thousand', async () => {
    // Ask for everything in one go; the transport hands back 1,000 and the
    // loop must notice the page was full and go round again.
    const t = table(1859);
    const read = await readAllPages(t.fetchPage, 20_000);
    expect(read.rows.length).toBe(1859);
    expect(read.capped).toBe(false);
  });

  it('stops at the cap, never asks past it, and says the answer may be partial', async () => {
    const t = table(5000);
    const read = await readAllPages(t.fetchPage, 2500);
    expect(read.rows.length).toBe(2500);
    expect(read.capped).toBe(true);
    expect(t.asked[t.asked.length - 1]).toEqual([2000, 2499]);
  });

  it('reports exactly-at-cap as capped rather than guessing there is nothing more', async () => {
    const t = table(1000);
    const read = await readAllPages(t.fetchPage, 1000);
    expect(read.rows.length).toBe(1000);
    expect(read.capped).toBe(true);
  });

  it('answers an empty table in one read', async () => {
    const t = table(0);
    const read = await readAllPages(t.fetchPage, 20_000);
    expect(read.rows).toEqual([]);
    expect(read.capped).toBe(false);
    expect(t.asked).toEqual([[0, 999]]);
  });
});
