/**
 * Which line of a CSV file holds the column headings.
 *
 * ── WHY THIS IS NOT ALWAYS LINE 1 ───────────────────────────────────────────
 * Plenty of banks put a covering block above the table — the account's name,
 * its balance, the date range the download covers — and only then the headings.
 * Nationwide's export is the one this app was reported on:
 *
 *     Account Name:,"FlexAccount"
 *     Account Balance:,"£1,234.56"
 *     Available Balance:,"£1,234.56"
 *
 *     Date,Transaction type,Description,Paid out,Paid in,Balance
 *     01/06/2026,Visa,ORCHARD LANE CAFE,4.20,,995.80
 *
 * Reading line 1 as the headings gives a file with two columns called
 * "Account Name:" and "FlexAccount", no date column, no amount column, and a
 * mapping step offering the user nothing they can use. The file is fine; the
 * assumption that a CSV begins with its table is what is wrong.
 *
 * ── WHAT DECIDES ────────────────────────────────────────────────────────────
 * The heading row is the one the TABLE agrees with. Two pieces of evidence,
 * both mechanical, both cheap:
 *
 *   AGREEMENT  — how many of the records below it have the same number of
 *                cells. A covering line has two cells above a six-column
 *                table; the heading row has six, like everything under it.
 *                This is the strong signal and it is weighted accordingly.
 *
 *   LABELNESS  — how many of its non-empty cells are words rather than figures
 *                or dates. Headings are labels; the first row of data is not.
 *                This is the tie-breaker that stops the detector from choosing
 *                the first DATA row of a table whose real heading row happens
 *                to have a trailing empty column.
 *
 * The first record is the default and it keeps the job unless a later one
 * scores STRICTLY higher. That asymmetry is deliberate: skipping a line that
 * was really data loses a transaction, and no scoring heuristic is worth a lost
 * transaction. A normal file scores the maximum on its first record and the
 * detector never moves.
 *
 * Whatever it decides is shown to the user, with the skipped lines printed and
 * a control to move the choice, because this is a guess about somebody else's
 * file and a guess presented as a fact is how the last set of bugs happened.
 */

import type { CsvRecord } from './csvTokenizer';

/**
 * How far down the file to look.
 *
 * A covering block is a handful of lines. Ten records is generous for that and
 * small enough that the detector can never wander into the middle of a long
 * statement and decide the table starts there.
 */
const MAX_CANDIDATE_RECORDS = 10;

/** How many records below a candidate are consulted about its shape. */
const FOLLOWERS_CONSULTED = 5;

/** Weight on cell-count agreement, relative to labelness's weight of 1. */
const AGREEMENT_WEIGHT = 2;

/** Anything that reads as a figure: -1,234.56, £4.20, (12.00), 45%. */
const LOOKS_NUMERIC = /^[-+(]?\s*[£$€¥]?\s*\d[\d,\s]*(\.\d+)?\s*\)?%?$/;

/** Anything that reads as a date: 01/06/2026, 2026-06-01, 1.6.26. */
const LOOKS_LIKE_DATE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}([T ].*)?$/;

export interface HeaderDetection {
  /** Index into the record array of the record holding the column headings. */
  recordIndex: number;
  /** Its physical line in the file, which is what the user is shown. */
  line: number;
  /**
   * Why this record and not the first one — prose for the mini-preview, or null
   * when the first record was taken and there is nothing to explain.
   */
  because: string | null;
}

/**
 * Find the heading record.
 *
 * Returns record 0 for an empty file, for a one-record file, and for every
 * ordinary file whose table starts at the top — which is the overwhelming
 * majority, and the case this must not disturb.
 */
export function detectHeaderRecord(records: readonly CsvRecord[]): HeaderDetection {
  if (records.length === 0) {
    return { recordIndex: 0, line: 1, because: null };
  }

  const limit = Math.min(MAX_CANDIDATE_RECORDS, records.length);
  let bestIndex = 0;
  let bestScore = scoreCandidate(records, 0);

  for (let index = 1; index < limit; index += 1) {
    const score = scoreCandidate(records, index);
    // STRICTLY higher, so a tie always keeps the earlier row. Skipping a line
    // that was really data is the one outcome with no recovery.
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  const chosen = records[bestIndex];
  return {
    recordIndex: bestIndex,
    line: chosen.line,
    because:
      bestIndex === 0
        ? null
        : `${bestIndex} ${bestIndex === 1 ? 'line' : 'lines'} above it ${
            bestIndex === 1 ? 'does' : 'do'
          } not have the same columns as the rows below, so ${
            bestIndex === 1 ? 'it looks' : 'they look'
          } like a covering block rather than part of the table.`
  };
}

/** A candidate's score. Higher is more header-like; see the file comment. */
function scoreCandidate(records: readonly CsvRecord[], index: number): number {
  const candidate = records[index];
  const followers = records.slice(index + 1, index + 1 + FOLLOWERS_CONSULTED);

  // Nothing below it to agree with — the last record of a file is not a
  // heading row, and neither is a one-cell line.
  if (followers.length === 0) return 0;
  if (candidate.cells.length < 2) return 0;

  const agreeing = followers.filter(record => record.cells.length === candidate.cells.length).length;
  const agreement = agreeing / followers.length;

  const named = candidate.cells.filter(cell => cell !== '');
  if (named.length < 2) return 0;
  const labels = named.filter(cell => !LOOKS_NUMERIC.test(cell) && !LOOKS_LIKE_DATE.test(cell)).length;
  const labelness = labels / named.length;

  return agreement * AGREEMENT_WEIGHT + labelness;
}

/**
 * The record index whose physical line is `line`, or null when no record starts
 * there.
 *
 * The user picks a heading row off the mini-preview, which prints physical line
 * numbers — that is the number they can also see in a text editor, so it is the
 * number the control speaks in. Everything downstream indexes records, so the
 * translation happens exactly here.
 */
export function recordIndexAtLine(records: readonly CsvRecord[], line: number): number | null {
  const index = records.findIndex(record => record.line === line);
  return index === -1 ? null : index;
}
