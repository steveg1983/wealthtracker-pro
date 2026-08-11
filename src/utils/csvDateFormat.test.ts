/**
 * Which way round a CSV's dates are, and what one cell of it means.
 *
 * The bug being pinned here is the quiet one: `01/06/2026` used to parse as
 * 6 January and `13/06/2026` as 13 June, from the same column of the same file,
 * so a UK statement imported with its first twelve days of every month
 * transposed and nothing said so.
 *
 * Every payee, figure and account name below is invented.
 */

import { describe, it, expect } from 'vitest';
import {
  describeAs,
  describeBothWays,
  inferDateFormat,
  parseCsvDateCell,
  resolveDateFormat,
  SUGGESTED_AMBIGUOUS_FORMAT,
  type DateFormatSample
} from './csvDateFormat';

/** The ISO day a cell reads as, or the refusal's own words. */
const read = (value: string, format: Parameters<typeof parseCsvDateCell>[1]): string => {
  const parsed = parseCsvDateCell(value, format);
  return parsed.ok ? parsed.iso : parsed.reason;
};

const samples = (...values: string[]): DateFormatSample[] =>
  values.map((value, index) => ({ value, line: index + 2 }));

describe('parseCsvDateCell', () => {
  describe('the ambiguous shape, which the format decides', () => {
    it('reads 01/06/2026 as 1 June under DD/MM/YYYY', () => {
      expect(read('01/06/2026', 'DD/MM/YYYY')).toBe('2026-06-01');
    });

    it('reads the SAME cell as 6 January under MM/DD/YYYY', () => {
      // The whole point: one cell, two readings, and only the declared format
      // decides. Nothing about the cell itself can.
      expect(read('01/06/2026', 'MM/DD/YYYY')).toBe('2026-01-06');
    });

    it('reads 13/06/2026 as 13 June under DD/MM/YYYY', () => {
      expect(read('13/06/2026', 'DD/MM/YYYY')).toBe('2026-06-13');
    });

    it('accepts dashes and dots as separators', () => {
      expect(read('01-06-2026', 'DD/MM/YYYY')).toBe('2026-06-01');
      expect(read('01.06.2026', 'DD/MM/YYYY')).toBe('2026-06-01');
      expect(read('1/6/2026', 'DD/MM/YYYY')).toBe('2026-06-01');
    });

    it('reads a two-digit year as this century', () => {
      // Bank exports still ship them; refusing the file over it helps nobody.
      expect(read('01/06/26', 'DD/MM/YYYY')).toBe('2026-06-01');
      expect(read('06/01/26', 'MM/DD/YYYY')).toBe('2026-06-01');
    });
  });

  describe('the year-first shape, which decides itself', () => {
    it('reads an ISO cell year-first whatever the format says', () => {
      // There is no reading under which 2026 is a day, so honouring a
      // contradictory selection here would refuse a file it has no quarrel
      // with. ISO detects itself.
      expect(read('2026-06-01', 'YYYY-MM-DD')).toBe('2026-06-01');
      expect(read('2026-06-01', 'DD/MM/YYYY')).toBe('2026-06-01');
      expect(read('2026-06-01', 'MM/DD/YYYY')).toBe('2026-06-01');
    });

    it('reads an ISO timestamp as its day', () => {
      expect(read('2026-06-01T14:32:10Z', 'YYYY-MM-DD')).toBe('2026-06-01');
      expect(read('2026-06-01 14:32:10', 'YYYY-MM-DD')).toBe('2026-06-01');
    });
  });

  describe('dates written in words, which no format governs', () => {
    it('reads them, and does not move them a day', () => {
      // `new Date('1 Jun 2026').toISOString()` is 2026-05-31 for every user
      // east of Greenwich, British Summer Time included. A statement line one
      // day early reconciles against nothing, so the ISO day is assembled from
      // the LOCAL calendar parts the string named.
      expect(read('1 Jun 2026', 'DD/MM/YYYY')).toBe('2026-06-01');
      expect(read('June 1, 2026', 'MM/DD/YYYY')).toBe('2026-06-01');
    });
  });

  describe('the refusals, which name the format', () => {
    /**
     * THE REFUSAL THAT NAMES THE CURE. A 13 in the month position is not a
     * broken row — it is a UK file being read as an American one, and every row
     * of it is being read wrong. "Unreadable date" here would send the user off
     * to correct their bank's export.
     */
    it('names the format when a month of 13 is impossible under it', () => {
      const reason = read('13/06/2026', 'MM/DD/YYYY');
      expect(reason).toContain('There is no month 13');
      expect(reason).toContain('"13/06/2026"');
      expect(reason).toContain('MM/DD/YYYY (month first)');
      expect(reason).toContain('Choose DD/MM/YYYY');
    });

    it('names the opposite cure for a US file being read day-first', () => {
      const reason = read('06/13/2026', 'DD/MM/YYYY');
      expect(reason).toContain('There is no month 13');
      expect(reason).toContain('DD/MM/YYYY (day first)');
      expect(reason).toContain('Choose MM/DD/YYYY');
    });

    it('refuses a day that does not exist in its month', () => {
      expect(read('31/02/2026', 'DD/MM/YYYY')).toBe(
        '"31/02/2026" is not a date that exists, read as DD/MM/YYYY (day first).'
      );
    });

    it('refuses a slash date under a year-first selection, and says what to choose', () => {
      const reason = read('01/06/2026', 'YYYY-MM-DD');
      expect(reason).toContain('does not start with a year');
      expect(reason).toContain('YYYY-MM-DD (year first)');
      expect(reason).toContain('Choose DD/MM/YYYY or MM/DD/YYYY');
    });

    it('refuses an empty cell', () => {
      expect(read('', 'DD/MM/YYYY')).toBe('No date in this row');
      expect(read('   ', 'DD/MM/YYYY')).toBe('No date in this row');
    });

    it('quotes back a cell it cannot read at all', () => {
      expect(read('not-a-date', 'DD/MM/YYYY')).toBe('Unreadable date: "not-a-date"');
    });
  });
});

describe('inferDateFormat — what the file itself proves', () => {
  it('is settled by one row past the 12th', () => {
    const evidence = inferDateFormat(samples('01/06/2026', '13/06/2026', '02/06/2026'));

    expect(evidence.outcome).toBe('decided');
    if (evidence.outcome !== 'decided') throw new Error('unreachable');
    expect(evidence.format).toBe('DD/MM/YYYY');
    // And it says WHICH row settled it, so the claim can be checked.
    expect(evidence.because).toContain('Line 3');
    expect(evidence.because).toContain('13/06/2026');
  });

  it('is settled the other way by a 13 in the second position', () => {
    const evidence = inferDateFormat(samples('06/01/2026', '06/13/2026'));

    expect(evidence.outcome).toBe('decided');
    if (evidence.outcome !== 'decided') throw new Error('unreachable');
    expect(evidence.format).toBe('MM/DD/YYYY');
  });

  it('detects an ISO column without being told', () => {
    const evidence = inferDateFormat(samples('2026-06-01', '2026-06-02'));

    expect(evidence.outcome).toBe('decided');
    if (evidence.outcome !== 'decided') throw new Error('unreachable');
    expect(evidence.format).toBe('YYYY-MM-DD');
  });

  /**
   * THE CASE THAT MUST NOT BE GUESSED. Twelve days of a month read identically
   * both ways round, and the two readings file the same transaction in
   * different months.
   */
  it('refuses to decide when every date could be read two ways', () => {
    const evidence = inferDateFormat(samples('01/06/2026', '02/06/2026', '03/06/2026'));

    expect(evidence.outcome).toBe('ambiguous');
    if (evidence.outcome !== 'ambiguous') throw new Error('unreachable');
    expect(evidence.example).toEqual({ value: '01/06/2026', line: 2 });
    expect(evidence.because).toContain('1 June 2026 or 6 January 2026');
  });

  it('refuses to decide when the file proves both ways at once', () => {
    // One file cannot be both, so nothing may be assumed about the rest of it.
    const evidence = inferDateFormat(samples('13/06/2026', '06/13/2026'));

    expect(evidence.outcome).toBe('conflicting');
    if (evidence.outcome !== 'conflicting') throw new Error('unreachable');
    expect(evidence.dayFirst.value).toBe('13/06/2026');
    expect(evidence.monthFirst.value).toBe('06/13/2026');
    expect(evidence.because).toContain('One file cannot be both');
  });

  it('treats a column with no two-way date as nothing to decide', () => {
    expect(inferDateFormat(samples('1 Jun 2026', '', '2 Jun 2026')).outcome).toBe('irrelevant');
    expect(inferDateFormat([]).outcome).toBe('irrelevant');
  });

  it('lets an ambiguous cell decide a column that also holds ISO cells', () => {
    // Mixed shapes: the ISO cells are read the same way whatever is chosen, so
    // only the ambiguous ones can raise a question — and here they cannot
    // answer it either.
    expect(inferDateFormat(samples('2026-06-01', '01/06/2026')).outcome).toBe('ambiguous');
  });

  it('ignores a cell that is broken both ways round', () => {
    // 13/14/2026 has no month in either position: it proves nothing and depends
    // on nothing, so it must not drag the column into a question that would not
    // change its fate. The ROW refuses; the column does not.
    const evidence = inferDateFormat(samples('2026-06-01', '13/14/2026'));
    expect(evidence.outcome).toBe('decided');
    if (evidence.outcome !== 'decided') throw new Error('unreachable');
    expect(evidence.format).toBe('YYYY-MM-DD');
  });

  it('scans the WHOLE column, not the first few rows', () => {
    // The row that settles the question may be four hundred rows down.
    const early = Array.from({ length: 400 }, () => '01/06/2026');
    const evidence = inferDateFormat(samples(...early, '13/06/2026'));

    expect(evidence.outcome).toBe('decided');
    if (evidence.outcome !== 'decided') throw new Error('unreachable');
    expect(evidence.format).toBe('DD/MM/YYYY');
  });
});

describe('resolveDateFormat — what the import will actually use', () => {
  it('honours an explicit choice over the file’s own evidence', () => {
    const proven = inferDateFormat(samples('13/06/2026'));
    expect(resolveDateFormat('MM/DD/YYYY', proven)).toBe('MM/DD/YYYY');
  });

  it('takes the file’s answer under auto', () => {
    expect(resolveDateFormat('auto', inferDateFormat(samples('13/06/2026')))).toBe('DD/MM/YYYY');
  });

  it('returns null under auto when the file cannot answer — that null is the gate', () => {
    expect(resolveDateFormat('auto', inferDateFormat(samples('01/06/2026')))).toBeNull();
    expect(resolveDateFormat('auto', inferDateFormat(samples('13/06/2026', '06/13/2026')))).toBeNull();
  });

  it('does not gate a column where nothing depends on the answer', () => {
    expect(resolveDateFormat('auto', inferDateFormat(samples('1 Jun 2026')))).toBe(
      SUGGESTED_AMBIGUOUS_FORMAT
    );
  });
});

describe('saying a date out loud', () => {
  it('spells one cell under one format', () => {
    expect(describeAs('01/06/2026', 'DD/MM/YYYY')).toBe('1 June 2026');
    expect(describeAs('01/06/2026', 'MM/DD/YYYY')).toBe('6 January 2026');
  });

  it('says nothing rather than something wrong when the cell will not read', () => {
    expect(describeAs('13/06/2026', 'MM/DD/YYYY')).toBeNull();
  });

  it('offers both readings of an ambiguous cell', () => {
    expect(describeBothWays('01/06/2026')).toBe('1 June 2026 or 6 January 2026');
  });

  it('falls back to the raw cell when one reading is impossible', () => {
    expect(describeBothWays('13/06/2026')).toBe('13/06/2026');
  });
});
