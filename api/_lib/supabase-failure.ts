/**
 * One line for a failed Supabase call, fit for a log line and a Sentry title.
 *
 * Observed 22 Sep 2026, 01:00–03:00 UTC: Supabase's edge answered the crons
 * with Cloudflare 522 pages (origin unreachable) for two hours. supabase-js
 * puts a non-JSON body straight into `error.message`, so Sentry titled the
 * two issues with the first 200 characters of an HTML page — "<!DOCTYPE
 * html> <!--[if lt IE 7]>…" — and the owner had to ask what it meant. The
 * status code, which said everything, was in the response and thrown away.
 *
 * So: an HTML body is named for what it is, with the status in front, and
 * every other failure keeps its own words with the status in front too. No
 * status (a test double, or a transport error before any response) prints
 * the message alone rather than "HTTP undefined".
 */
export interface SupabaseFailure {
  message: string;
  code?: string | null;
}

const LOOKS_LIKE_HTML = /^\s*<(?:!doctype\s+html|html)\b/i;

export const describeSupabaseFailure = (error: SupabaseFailure, status?: number): string => {
  const prefix = typeof status === 'number' && status > 0 ? `HTTP ${status}` : '';
  if (LOOKS_LIKE_HTML.test(error.message)) {
    const what = 'the gateway answered with an HTML page instead of JSON (Supabase unreachable upstream; the next run retries)';
    return prefix ? `${prefix} — ${what}` : what;
  }
  const code = error.code ? ` [${error.code}]` : '';
  return prefix ? `${prefix}${code}: ${error.message}` : `${error.message}${code}`;
};
