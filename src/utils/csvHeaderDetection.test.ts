/**
 * Which line of a CSV holds the column headings.
 *
 * Two things are being held at once, and the second matters more than the
 * first: that a covering block above the table is recognised, and that a NORMAL
 * file — the overwhelming majority — is never disturbed. Skipping a line that
 * was really data loses a transaction, and no scoring heuristic is worth a lost
 * transaction.
 *
 * Every payee, figure and account name below is invented.
 */

import { describe, it, expect } from 'vitest';
import { detectHeaderRecord, recordIndexAtLine } from './csvHeaderDetection';
import { tokenizeCsv } from './csvTokenizer';

const detect = (content: string) => detectHeaderRecord(tokenizeCsv(content).records);

/** An ordinary two-column-format statement, with no covering block. */
const PLAIN_STATEMENT = [
  'Date,Transaction type,Description,Paid out,Paid in,Balance',
  '01/06/2026,Visa,ORCHARD LANE CAFE,4.20,,995.80',
  '02/06/2026,Bank credit,MERIDIAN LTD,,1200.00,2195.80',
  '03/06/2026,Visa,BLUEBIRD GARAGE,52.40,,2143.40'
].join('\n');

describe('detectHeaderRecord', () => {
  describe('the files it must not disturb', () => {
    it('takes line 1 of an ordinary statement, and explains nothing', () => {
      const detected = detect(PLAIN_STATEMENT);

      expect(detected).toEqual({ recordIndex: 0, line: 1, because: null });
    });

    it('takes line 1 even when the table is only two rows long', () => {
      expect(detect('Date,Amount\n01/06/2026,4.20').recordIndex).toBe(0);
    });

    it('takes line 1 of a file with only a heading row and nothing else', () => {
      expect(detect('Date,Description,Amount').recordIndex).toBe(0);
    });

    it('takes line 1 of an empty file rather than falling over', () => {
      expect(detect('')).toEqual({ recordIndex: 0, line: 1, because: null });
    });

    it('takes line 1 when the table has a trailing empty column', () => {
      // A heading row with a blank last column still agrees with its rows, and
      // must not lose to the first row of real data.
      expect(
        detect('Date,Description,Amount,\n01/06/2026,ORCHARD LANE CAFE,-4.20,\n02/06/2026,MERIDIAN LTD,1200.00,')
          .recordIndex
      ).toBe(0);
    });
  });

  describe('a covering block above the table', () => {
    /** Nationwide-style: three metadata lines, a blank, then the real table. */
    const WITH_PREAMBLE = [
      'Account Name:,"Everyday Current"',
      'Account Balance:,"£2,143.40"',
      'Available Balance:,"£2,143.40"',
      '',
      PLAIN_STATEMENT
    ].join('\n');

    it('finds the heading row under it', () => {
      const detected = detect(WITH_PREAMBLE);

      expect(detected.recordIndex).toBe(3);
      // The blank line counts as a line, so the headings are on line 5 of the
      // file even though they are the 4th record.
      expect(detected.line).toBe(5);
    });

    it('says why it skipped them', () => {
      const detected = detect(WITH_PREAMBLE);

      expect(detected.because).toContain('3 lines above it');
      expect(detected.because).toContain('do not have the same columns as the rows below');
    });

    it('uses the singular for a single skipped line', () => {
      const detected = detect(
        ['Downloaded 04/06/2026 by Everyday Current', PLAIN_STATEMENT].join('\n')
      );

      expect(detected.recordIndex).toBe(1);
      expect(detected.because).toContain('1 line above it does not');
    });

    it('is not fooled by a covering line that happens to have the same cell count', () => {
      // Six cells, like the table — but they are figures and dates, not labels,
      // so labelness breaks the tie the way it is meant to.
      const detected = detect(
        [
          '01/06/2026,2143.40,995.80,4.20,1200.00,52.40',
          PLAIN_STATEMENT
        ].join('\n')
      );

      expect(detected.recordIndex).toBe(1);
    });

    it('does not wander into the middle of a long statement', () => {
      // Every row of a table agrees with every other row, so agreement alone
      // would let the detector pick row 300 as easily as row 1. The
      // earliest-wins rule is what stops it.
      const long = [
        'Date,Description,Amount',
        ...Array.from({ length: 300 }, (_, i) => `0${(i % 9) + 1}/06/2026,PAYEE ${i},-1.00`)
      ].join('\n');

      expect(detect(long).recordIndex).toBe(0);
    });
  });

  describe('recordIndexAtLine', () => {
    const records = tokenizeCsv(PLAIN_STATEMENT).records;

    it('finds the record that starts on a line', () => {
      expect(recordIndexAtLine(records, 1)).toBe(0);
      expect(recordIndexAtLine(records, 3)).toBe(2);
    });

    it('answers null for a line no record starts on', () => {
      // Which is how a heading line the user cannot have meant is refused
      // rather than silently rounded to a neighbour.
      expect(recordIndexAtLine(records, 99)).toBeNull();
    });

    it('answers the record’s START line for a multi-line record', () => {
      const multiline = tokenizeCsv(
        'Date,Description,Amount\n01/06/2026,"BLUEBIRD GARAGE\nInvoice 4471",-52.40\n02/06/2026,MERIDIAN LTD,1200.00'
      ).records;

      expect(recordIndexAtLine(multiline, 2)).toBe(1);
      // Line 3 is the middle of that record, not the start of one.
      expect(recordIndexAtLine(multiline, 3)).toBeNull();
      expect(recordIndexAtLine(multiline, 4)).toBe(2);
    });
  });
});
