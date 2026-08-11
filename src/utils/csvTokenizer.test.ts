/**
 * The CSV tokenizer, held to RFC 4180 — and to its line numbers.
 *
 * Every payee, figure and account name below is invented.
 */

import { describe, it, expect } from 'vitest';
import { tokenizeCsv } from './csvTokenizer';

/** The cells of each record, for the many assertions that only care about those. */
const cellsOf = (content: string): string[][] =>
  tokenizeCsv(content).records.map(record => record.cells);

/** The physical start line of each record. */
const linesOf = (content: string): number[] =>
  tokenizeCsv(content).records.map(record => record.line);

describe('tokenizeCsv', () => {
  describe('the plain cases it must not disturb', () => {
    it('reads an ordinary file into rows and cells', () => {
      expect(
        cellsOf('Date,Description,Amount\n2026-06-01,ORCHARD LANE CAFE,-4.20')
      ).toEqual([
        ['Date', 'Description', 'Amount'],
        ['2026-06-01', 'ORCHARD LANE CAFE', '-4.20']
      ]);
    });

    it('keeps empty cells as cells', () => {
      // A bank's two-column format is empty cells by design: the credit column
      // is blank on every debit row.
      expect(cellsOf('a,,c')).toEqual([['a', '', 'c']]);
      expect(cellsOf(',,')).toEqual([['', '', '']]);
    });

    it('trims the padding banks leave around their cells', () => {
      expect(cellsOf('Date , Amount\n2026-06-01 ,  4.20 ')).toEqual([
        ['Date', 'Amount'],
        ['2026-06-01', '4.20']
      ]);
    });

    it('reads tab- and semicolon-separated files too', () => {
      expect(cellsOf('Date\tAmount\n2026-06-01\t4.20')).toEqual([
        ['Date', 'Amount'],
        ['2026-06-01', '4.20']
      ]);
      expect(cellsOf('Data;Importo\n2026-06-01;4.20')).toEqual([
        ['Data', 'Importo'],
        ['2026-06-01', '4.20']
      ]);
    });

    /**
     * ALL THREE DELIMITERS ARE LIVE AT ONCE, and that is a real limitation
     * rather than an oversight — it is what this importer has always done, and
     * sniffing exactly one is a guess that fails silently when it is wrong.
     *
     * Pinned here so the limitation is a stated fact with a stated cure: a
     * continental file whose amounts use a decimal comma must quote them, and
     * the exports that do this in practice (Intesa, UniCredit) do quote them.
     */
    it('splits an unquoted decimal comma in a semicolon file — the quote is the cure', () => {
      expect(cellsOf('Data;Importo\n2026-06-01;4,20')).toEqual([
        ['Data', 'Importo'],
        ['2026-06-01', '4', '20']
      ]);
      expect(cellsOf('Data;Importo\n2026-06-01;"4,20"')).toEqual([
        ['Data', 'Importo'],
        ['2026-06-01', '4,20']
      ]);
    });

    it('reads an empty file as no records at all', () => {
      expect(tokenizeCsv('').records).toEqual([]);
    });

    it('reads a single line with no trailing newline', () => {
      expect(cellsOf('Date,Amount')).toEqual([['Date', 'Amount']]);
    });
  });

  describe('quoting, as RFC 4180 defines it', () => {
    it('keeps a delimiter that sits inside quotes', () => {
      // "PARIS, FR" is one payee. Split on the comma it is two columns and the
      // amount lands one column to the right of where it belongs.
      expect(cellsOf('Date,Description,Amount\n2026-06-01,"BRASSERIE DUVAL, PARIS FR",-31.10')).toEqual([
        ['Date', 'Description', 'Amount'],
        ['2026-06-01', 'BRASSERIE DUVAL, PARIS FR', '-31.10']
      ]);
    });

    it('reads a doubled quote as one literal quote', () => {
      expect(cellsOf('"He said ""hello""",2.00')).toEqual([['He said "hello"', '2.00']]);
    });

    it('reads a cell that is nothing but a doubled quote', () => {
      expect(cellsOf('"""",2.00')).toEqual([['"', '2.00']]);
    });

    it('keeps a newline that sits inside quotes, as part of the value', () => {
      // THE BUG THIS TOKENIZER EXISTS FOR. Split-on-newline turned this one
      // transaction into two half-rows: one with no amount, one with no date,
      // both refused — and the £52.40 that WAS in the file simply absent.
      const { records } = tokenizeCsv(
        'Date,Description,Amount\n2026-06-01,"BLUEBIRD GARAGE\nInvoice 4471",-52.40'
      );

      expect(records).toHaveLength(2);
      expect(records[1].cells).toEqual([
        '2026-06-01',
        'BLUEBIRD GARAGE\nInvoice 4471',
        '-52.40'
      ]);
    });

    it('keeps several newlines inside one quoted field', () => {
      const { records } = tokenizeCsv('a,"one\ntwo\nthree",b');
      expect(records[0].cells).toEqual(['a', 'one\ntwo\nthree', 'b']);
    });

    it('keeps a delimiter AND a newline in the same quoted field', () => {
      const { records } = tokenizeCsv('a,"one, two\nthree; four",b');
      expect(records[0].cells).toEqual(['a', 'one, two\nthree; four', 'b']);
    });

    it('keeps text that follows a closing quote rather than refusing the file', () => {
      // Malformed by the letter of the RFC, unambiguous in meaning, and
      // accepted by every version of this importer. Refusing it would refuse
      // files that have always worked.
      expect(cellsOf('"abc"def,2.00')).toEqual([['abcdef', '2.00']]);
    });

    it('reports a quote that is never closed, with the line it was opened on', () => {
      const result = tokenizeCsv(
        'Date,Description,Amount\n2026-06-01,"ORCHARD LANE CAFE,-4.20\n2026-06-02,BLUEBIRD GARAGE,-52.40'
      );

      // Everything after the stray quote has been swallowed, so the rows below
      // are ABSENT rather than wrong — which is exactly why the caller has to
      // be told rather than shown a short preview.
      expect(result.unterminatedQuoteLine).toBe(2);
    });

    it('reports nothing when every quote is closed', () => {
      expect(tokenizeCsv('a,"b",c').unterminatedQuoteLine).toBeNull();
    });
  });

  describe('line endings', () => {
    it('reads CRLF files', () => {
      expect(cellsOf('Date,Amount\r\n2026-06-01,4.20\r\n')).toEqual([
        ['Date', 'Amount'],
        ['2026-06-01', '4.20']
      ]);
    });

    it('reads lone-CR files, as an older Mac spreadsheet writes them', () => {
      expect(cellsOf('Date,Amount\r2026-06-01,4.20')).toEqual([
        ['Date', 'Amount'],
        ['2026-06-01', '4.20']
      ]);
    });

    it('reads a file that mixes all three endings', () => {
      // A file that has been through a Windows mail server and a Mac
      // spreadsheet contains all of them, and none of them is the user's fault.
      expect(cellsOf('a,1\r\nb,2\rc,3\nd,4')).toEqual([
        ['a', '1'],
        ['b', '2'],
        ['c', '3'],
        ['d', '4']
      ]);
    });

    it('normalises a CRLF inside a quoted field to one newline', () => {
      // A carriage return carried into a payee is invisible and un-searchable.
      const { records } = tokenizeCsv('a,"one\r\ntwo",b');
      expect(records[0].cells[1]).toBe('one\ntwo');
    });

    it('normalises a lone CR inside a quoted field too', () => {
      expect(tokenizeCsv('a,"one\rtwo",b').records[0].cells[1]).toBe('one\ntwo');
    });
  });

  describe('blank lines are not rows', () => {
    it('drops a trailing newline rather than inventing an empty row', () => {
      expect(cellsOf('Date,Amount\n2026-06-01,4.20\n')).toHaveLength(2);
    });

    it('drops the blank line a file puts between months', () => {
      expect(cellsOf('Date,Amount\n2026-06-01,4.20\n\n2026-07-01,9.99')).toEqual([
        ['Date', 'Amount'],
        ['2026-06-01', '4.20'],
        ['2026-07-01', '9.99']
      ]);
    });

    it('drops a whitespace-only line', () => {
      expect(cellsOf('Date,Amount\n   \n2026-06-01,4.20')).toHaveLength(2);
    });

    it('keeps a line of nothing but delimiters, which is a row of empty cells', () => {
      // `,,` is three columns saying nothing; `   ` is not a row at all. The
      // difference matters because the first is a row the import must account
      // for and the second is a row that was never there.
      expect(cellsOf('a,b,c\n,,')).toEqual([
        ['a', 'b', 'c'],
        ['', '', '']
      ]);
    });

    it('keeps a quoted whitespace cell, which the file went out of its way to write', () => {
      expect(cellsOf('"   "')).toEqual([['']]);
      expect(tokenizeCsv('"   "').records).toHaveLength(1);
    });
  });

  describe('physical line numbers', () => {
    it('numbers ordinary rows from 1, like a text editor', () => {
      expect(linesOf('Date,Amount\n2026-06-01,4.20\n2026-06-02,9.99')).toEqual([1, 2, 3]);
    });

    /**
     * THE BOOKKEEPING THIS WHOLE FILE TURNS ON.
     *
     * Row index plus two is right only while every record is one line long.
     * The moment a quoted description contains a newline the two part company
     * — and they stay parted for the whole rest of the file, so every refusal
     * printed after it sends the reader to the wrong row of their own file.
     */
    it('stays true across a multi-line row, for every row after it', () => {
      const content = [
        'Date,Description,Amount', // line 1
        '2026-06-01,ORCHARD LANE CAFE,-4.20', // line 2
        '2026-06-02,"BLUEBIRD GARAGE', // line 3 …
        'Invoice 4471",-52.40', // … line 4
        '2026-06-03,MERIDIAN LTD,1200.00' // line 5
      ].join('\n');

      const { records } = tokenizeCsv(content);

      expect(records.map(record => record.line)).toEqual([1, 2, 3, 5]);
      // The row that spans two of them says so.
      expect(records[2].lineSpan).toBe(2);
      expect(records[3].lineSpan).toBe(1);
      // And the row AFTER it is the 4th record but the 5th line — the exact
      // gap `index + 2` could never see.
      expect(records[3].cells[1]).toBe('MERIDIAN LTD');
    });

    it('counts a three-line quoted field as three lines', () => {
      const { records } = tokenizeCsv('a,"one\ntwo\nthree",b\nnext,row,here');
      expect(records[0].lineSpan).toBe(3);
      expect(records[1].line).toBe(4);
    });

    it('counts blank lines even though it drops them', () => {
      // The blank line is not a row, but it IS a line, and the row after it is
      // where the file says it is.
      expect(linesOf('Date,Amount\n\n2026-06-01,4.20')).toEqual([1, 3]);
    });

    it('counts a leading blank line, so nothing above the table shifts the numbering', () => {
      expect(linesOf('\nDate,Amount\n2026-06-01,4.20')).toEqual([2, 3]);
    });

    it('counts CRLF endings as one line each', () => {
      expect(linesOf('a,1\r\nb,2\r\nc,3')).toEqual([1, 2, 3]);
    });
  });

  describe('the raw text of each record', () => {
    it('hands back the line exactly as the file wrote it', () => {
      // The heading-line picker prints these, and re-serialising them from the
      // cells would show the user something their file does not contain.
      const { records } = tokenizeCsv('Account Name:,"Everyday Current"\nDate,Amount');
      expect(records[0].raw).toBe('Account Name:,"Everyday Current"');
    });

    it('hands back both lines of a multi-line record', () => {
      const { records } = tokenizeCsv('a,"one\ntwo",b');
      expect(records[0].raw).toBe('a,"one\ntwo",b');
    });
  });
});
