/**
 * A CSV file read the way RFC 4180 says it should be read.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The importer used to split the file on '\n' FIRST and look for quotes second.
 * That is backwards, and it loses data quietly. A quoted field may contain a
 * newline — the RFC says so, and every spreadsheet that has ever exported a
 * multi-line memo relies on it:
 *
 *     Date,Description,Amount
 *     2026-06-01,"BLUEBIRD GARAGE
 *     Invoice 4471",-52.40
 *
 * Split-first turns that one transaction into two rows: a row ending after
 * "BLUEBIRD GARAGE with no amount, and a row beginning Invoice 4471" with a
 * date nobody can read. Both are then reported as rows that could not be read,
 * and the £52.40 that WAS in the file is simply absent from the register.
 *
 * So the newline is not a boundary until the tokenizer knows it is outside a
 * quote. That is the whole point of a state machine and the reason this cannot
 * be done with `split`.
 *
 * ── PHYSICAL LINE NUMBERS ───────────────────────────────────────────────────
 * Every refusal this app prints about a row quotes a line number, and a person
 * uses it to find that row in a text editor. So the number has to be the
 * PHYSICAL line of the file, not the index of the record — and once one record
 * can span three lines, those two numbers part company for the whole rest of
 * the file.
 *
 * The counter is therefore advanced by the SCANNER, not by the record loop: any
 * newline the machine consumes increments it, including the ones inside a
 * quoted field, which are content and a line break at the same time. Each
 * record records the line it STARTED on (`line`) and how many it occupies
 * (`lineSpan`), both taken before the counter moves on to the next record.
 * Blank lines are dropped as records but still advance the counter, so a file
 * that separates its months with an empty line keeps honest numbering.
 */

/**
 * What a bank might separate its columns with.
 *
 * All three are treated as delimiters in the same file, which is what this app
 * has always done: exports from continental banks use ';', exports pasted out
 * of a spreadsheet use '\t', and the sniffing needed to pick exactly one is a
 * guess that fails silently when it is wrong. Inside quotes none of them
 * separates anything, which is the case that actually matters — "PARIS, FR" is
 * one payee.
 */
const DELIMITERS = new Set([',', '\t', ';']);

/** One record of a CSV file: its cells, and where in the file it came from. */
export interface CsvRecord {
  /**
   * The cells, in file order, with quotes resolved and outer whitespace
   * removed. Trimming matches what this importer has always done — bank
   * exports pad cells (`, 4.20,`) and a payee of " TESCO" would never match
   * a rule written for "TESCO".
   */
  cells: string[];
  /** 1-based PHYSICAL line of the file where this record STARTS. */
  line: number;
  /** How many physical lines it occupies — more than 1 only when a quoted field held a newline. */
  lineSpan: number;
  /**
   * The record exactly as it appears in the file, newlines and all.
   *
   * Kept because the preamble mini-preview shows the user the lines being
   * ignored, and showing them re-serialised from the cells would show them
   * something the file does not contain.
   */
  raw: string;
}

export interface CsvTokenizeResult {
  records: CsvRecord[];
  /**
   * The line a quote was opened on and never closed, or null when the file is
   * well formed.
   *
   * A file like this is not a near-miss: everything from the stray quote to the
   * end of the file has been swallowed into one cell, so the rows after it are
   * gone rather than wrong. The caller refuses the file and says which line to
   * look at, because that is a repair the user can actually make.
   */
  unterminatedQuoteLine: number | null;
}

/**
 * Read a CSV file into records.
 *
 * Quoting follows RFC 4180: a field may be wrapped in double quotes; inside
 * them a doubled quote ("") is one literal quote, and delimiters and newlines
 * are ordinary characters. CRLF, bare LF and bare CR are all accepted as line
 * endings — a file that has been through a Windows mail server and a Mac
 * spreadsheet may contain all three — and a newline captured INSIDE a quoted
 * field is normalised to '\n' so a payee does not carry an invisible carriage
 * return into the register.
 *
 * Text outside a closing quote is kept rather than rejected (`"abc"def` reads
 * as `abcdef`). The RFC calls that malformed; refusing it would refuse files
 * this importer has always accepted, and there is no ambiguity about what it
 * says.
 */
export function tokenizeCsv(content: string): CsvTokenizeResult {
  const records: CsvRecord[] = [];

  let index = 0;
  /** The physical line the scanner is standing on. 1-based, like a text editor. */
  let line = 1;
  let cells: string[] = [];
  let current = '';
  let inQuotes = false;
  let recordStartLine = 1;
  let recordStartOffset = 0;
  let quoteOpenedAtLine: number | null = null;

  /**
   * Close the record that ends at `endOffset`, which sat on physical lines
   * `recordStartLine`..`endLine`. A record whose raw text is nothing but
   * whitespace is NOT a record: files that end with a newline, or that separate
   * months with a blank line, used to produce an empty row apiece, counted in
   * the preview and then reported as a row that could not be read — an error
   * report about nothing.
   */
  const endRecord = (endOffset: number, endLine: number): void => {
    cells.push(current.trim());
    const raw = content.slice(recordStartOffset, endOffset);
    if (raw.trim() !== '') {
      records.push({
        cells,
        line: recordStartLine,
        lineSpan: endLine - recordStartLine + 1,
        raw
      });
    }
    cells = [];
    current = '';
  };

  while (index < content.length) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          current += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        quoteOpenedAtLine = null;
        index += 1;
        continue;
      }
      if (char === '\r' || char === '\n') {
        // A line break inside a quoted field is BOTH content and a physical
        // line. Normalised to '\n' so the stored value carries no carriage
        // returns, and counted so the numbering below stays true.
        current += '\n';
        index += char === '\r' && content[index + 1] === '\n' ? 2 : 1;
        line += 1;
        continue;
      }
      current += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      quoteOpenedAtLine = line;
      index += 1;
      continue;
    }

    if (DELIMITERS.has(char)) {
      cells.push(current.trim());
      current = '';
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      const endOffset = index;
      const endLine = line;
      index += char === '\r' && content[index + 1] === '\n' ? 2 : 1;
      line += 1;
      endRecord(endOffset, endLine);
      recordStartLine = line;
      recordStartOffset = index;
      continue;
    }

    current += char;
    index += 1;
  }

  // The last record, when the file does not end with a newline. Guarded so a
  // file that DOES end with one produces no phantom empty row.
  if (cells.length > 0 || current !== '' || inQuotes) {
    endRecord(content.length, line);
  }

  return { records, unterminatedQuoteLine: inQuotes ? quoteOpenedAtLine : null };
}
