/**
 * Reading past PostgREST's row cap.
 *
 * Supabase answers a plain select with at most 1,000 rows whatever range is
 * asked for — the request is clamped, not refused — and the register's own
 * client has always paged in thousands for exactly that reason
 * (`transactionService.ts`, PAGE_SIZE). The connector's first balance sum did
 * not, and an account with 1,859 rows read −438,191.80 where the app shows
 * 0.00 (the owner's first conversation with it, 21 Oct 2026). Every read here
 * that can exceed a page goes through this one loop, so the cap is a fact
 * about the transport and never again a fact about a figure.
 *
 * The loop stops at the first short page, or at `cap` rows, and says which:
 * a caller that hits the cap reports its answer as partial rather than
 * silently exact.
 */

export const POSTGREST_PAGE = 1000;

export interface PagedRead<T> {
  rows: T[];
  /** True when `cap` was reached and more rows may exist. */
  capped: boolean;
}

/**
 * @param fetchPage — reads rows [from, to] inclusive, as `.range(from, to)` does.
 * @param cap — the most rows the caller will take; the read stops there.
 */
export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  cap: number,
  pageSize: number = POSTGREST_PAGE
): Promise<PagedRead<T>> {
  const rows: T[] = [];
  let from = 0;
  while (rows.length < cap) {
    const want = Math.min(pageSize, cap - rows.length);
    const page = await fetchPage(from, from + want - 1);
    rows.push(...page);
    if (page.length < want) return { rows, capped: false };
    from += page.length;
  }
  // Exactly `cap` rows arrived in full pages: there may be more, and the
  // only way to know is one more read, which a caller may not want to pay
  // for. Say "capped"; a caller needing certainty raises its cap.
  return { rows, capped: true };
}
