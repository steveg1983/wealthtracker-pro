/**
 * Which way round a CSV's dates are written, and what one cell of it means.
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * `new Date('01/06/2026')` is 6 January 2026. `new Date('13/06/2026')` is not a
 * date JavaScript will read that way at all, so the old parser fell through to
 * a DD/MM branch and made it 13 June 2026. Both of those lines are in the same
 * UK bank statement. So a UK file imported with its first twelve days of every
 * month silently transposed — June the 1st filed as January the 6th, June the
 * 2nd as February the 6th — and the thirteenth onwards filed correctly. Nothing
 * failed. Nothing was reported. The register simply disagreed with the bank,
 * scattered across twelve months, and the only way to find it was to check
 * every row by hand.
 *
 * A guess cannot fix that, because the guess is right most of the time and the
 * times it is wrong look exactly like the times it is right. Only two things
 * fix it: EVIDENCE from the file, when the file happens to contain any, and
 * ASKING, when it does not.
 *
 * ── THE EVIDENCE RULES ──────────────────────────────────────────────────────
 * For a cell written `a/b/y` with a and b of one or two digits:
 *
 *   a > 12   a cannot be a month, so the file writes the DAY first.
 *   b > 12   b cannot be a month, so the file writes the MONTH first.
 *   both ≤12 the cell is ambiguous and proves nothing.
 *
 * One proving row settles the whole column, because a bank does not change
 * format halfway down a statement — but if one row proves day-first and another
 * proves month-first, the file is not one format and nothing may be assumed:
 * that is reported as conflicting and the user is asked.
 *
 * A cell written with a four-digit first part is year-first by SHAPE, whatever
 * anybody has selected. There is no reading of `2026-06-01` under which 2026 is
 * a day. ISO detects itself, and a column of it needs no decision at all.
 *
 * ── AND NO LOCAL-MIDNIGHT DRIFT ─────────────────────────────────────────────
 * Every ISO day this file produces is assembled from the digits the cell
 * contained. The old code did `new Date(cell).toISOString().split('T')[0]`,
 * and for anything JavaScript parses as LOCAL time — '01 Jun 2026' — that
 * moves the date back a day for every user east of Greenwich, British Summer
 * Time included. A statement line one day early reconciles against nothing.
 */

/** The three ways a numeric date cell can be laid out. */
export const CSV_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;

export type CsvDateFormat = (typeof CSV_DATE_FORMATS)[number];

/** What the control on the mapping step holds: a format, or "work it out". */
export type CsvDateFormatChoice = CsvDateFormat | 'auto';

/** How each format is offered, saying what it MEANS and not just what it looks like. */
export const DATE_FORMAT_LABELS: Record<CsvDateFormat, string> = {
  'DD/MM/YYYY': 'DD/MM/YYYY — day first (UK, Ireland, most of Europe)',
  'MM/DD/YYYY': 'MM/DD/YYYY — month first (United States)',
  'YYYY-MM-DD': 'YYYY-MM-DD — year first (ISO, and most app exporters)'
};

/** How a refusal names the format it read a row under. */
export const DATE_FORMAT_NAMES: Record<CsvDateFormat, string> = {
  'DD/MM/YYYY': 'DD/MM/YYYY (day first)',
  'MM/DD/YYYY': 'MM/DD/YYYY (month first)',
  'YYYY-MM-DD': 'YYYY-MM-DD (year first)'
};

/** The other slash format, named in a refusal as the cure. */
const OPPOSITE_SLASH_FORMAT: Record<CsvDateFormat, CsvDateFormat> = {
  'DD/MM/YYYY': 'MM/DD/YYYY',
  'MM/DD/YYYY': 'DD/MM/YYYY',
  'YYYY-MM-DD': 'DD/MM/YYYY'
};

/**
 * The format offered first when a file is ambiguous and the user must confirm.
 *
 * A default, not a decision. It is only ever a suggestion printed next to a
 * control the user still has to touch — the confirmation is the safety, and a
 * default that imported without one would be the same silent guess this file
 * exists to remove.
 */
export const SUGGESTED_AMBIGUOUS_FORMAT: CsvDateFormat = 'DD/MM/YYYY';

/** A date cell as an ISO day, or a refusal in the words the user will read. */
export type CsvDateCell = { ok: true; iso: string } | { ok: false; reason: string };

/** A cell of the date column, with the file line it sits on. */
export interface DateFormatSample {
  value: string;
  line: number;
}

/**
 * What the file itself says about which way round its dates are.
 *
 * `decided` and `irrelevant` both mean the import may proceed without asking:
 * either the file proved a format, or no cell in the column has a reading that
 * depends on one. `ambiguous` and `conflicting` mean it may not.
 */
export type DateFormatInference =
  | { outcome: 'decided'; format: CsvDateFormat; because: string }
  | { outcome: 'irrelevant'; because: string }
  | { outcome: 'ambiguous'; because: string; example: DateFormatSample }
  | {
      outcome: 'conflicting';
      because: string;
      dayFirst: DateFormatSample;
      monthFirst: DateFormatSample;
    };

/** `2026-06-01`, and the same with an ISO time hung off it. */
const YEAR_FIRST = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/;

/** `01/06/2026`, `1-6-26`, `01.06.2026` — the shape whose meaning is a decision. */
const TWO_PART_THEN_YEAR = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/;

/**
 * A two-digit year belongs to this century.
 *
 * Bank exports still ship them, and refusing the file over it helps nobody. The
 * window is stated rather than inferred from today's date so that the same file
 * imports to the same dates next year as it does this year.
 */
const TWO_DIGIT_YEAR_BASE = 2000;

/**
 * Read one date cell under a declared format.
 *
 * The format decides ONLY the cells whose meaning depends on it — the
 * `01/06/2026` shape. A year-first cell is read year-first whatever is
 * selected, because there is no other reading of it; a cell written in words
 * ('1 Jun 2026') is read as written, for the same reason. Making the control
 * reject those would be making it reject files it has no quarrel with.
 */
export function parseCsvDateCell(value: string, format: CsvDateFormat): CsvDateCell {
  const trimmed = value.trim();
  if (!trimmed) {
    // An empty cell is not a date and never was. It used to reach the import as
    // "no date at all", which became `new Date('undefined')` — a row written
    // with an Invalid Date, which no register can sort and no reconciliation
    // can find.
    return { ok: false, reason: 'No date in this row' };
  }

  const yearFirst = YEAR_FIRST.exec(trimmed);
  if (yearFirst) {
    return assemble(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3]),
      trimmed,
      'YYYY-MM-DD'
    );
  }

  const twoPart = TWO_PART_THEN_YEAR.exec(trimmed);
  if (twoPart) {
    const first = Number(twoPart[1]);
    const second = Number(twoPart[2]);
    const year = normaliseYear(twoPart[3]);

    if (format === 'YYYY-MM-DD') {
      // Declared year-first, and this cell is plainly not. Said rather than
      // read some other way, because reading it some other way is the silent
      // substitution this whole file exists to stop.
      return {
        ok: false,
        reason:
          `"${trimmed}" does not start with a year, and this column is being read as ` +
          `${DATE_FORMAT_NAMES['YYYY-MM-DD']}. Choose DD/MM/YYYY or MM/DD/YYYY for a file ` +
          `that writes the day or the month first.`
      };
    }

    const day = format === 'DD/MM/YYYY' ? first : second;
    const month = format === 'DD/MM/YYYY' ? second : first;
    return assemble(year, month, day, trimmed, format);
  }

  // Not a numeric date at all: '1 Jun 2026', 'June 1, 2026', an ISO timestamp
  // with an offset. None of those is ambiguous, so none of them is the
  // control's business — but the LOCAL calendar parts are read off the parsed
  // date rather than its UTC ones, because the string named a local day and
  // `toISOString()` would move it back one for every user east of Greenwich.
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return assemble(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate(),
      trimmed,
      format
    );
  }

  return { ok: false, reason: `Unreadable date: "${trimmed}"` };
}

/**
 * Build the ISO day, refusing the parts that cannot be one — and naming the
 * format when the format is what made them impossible.
 */
function assemble(
  year: number,
  month: number,
  day: number,
  cell: string,
  format: CsvDateFormat
): CsvDateCell {
  if (month < 1 || month > 12) {
    // THE REFUSAL THAT NAMES THE CURE. A 13 in the month position under
    // MM/DD/YYYY is not a broken row — it is a UK file being read as an
    // American one, and every row of it is being read wrong. Saying "unreadable
    // date" here would send the user to correct their bank's export.
    return {
      ok: false,
      reason:
        `There is no month ${month} — "${cell}" is being read as ${DATE_FORMAT_NAMES[format]}. ` +
        `Choose ${OPPOSITE_SLASH_FORMAT[format]} if this file writes ` +
        `${format === 'DD/MM/YYYY' ? 'the month' : 'the day'} first.`
    };
  }

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return {
      ok: false,
      reason: `"${cell}" is not a date that exists, read as ${DATE_FORMAT_NAMES[format]}.`
    };
  }

  return { ok: true, iso: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` };
}

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

const normaliseYear = (digits: string): number =>
  digits.length === 2 ? TWO_DIGIT_YEAR_BASE + Number(digits) : Number(digits);

/**
 * What the file's own date column proves about its format.
 *
 * Every cell is consulted, not a sample: the one row that settles the question
 * may be the 13th of a month four hundred rows down, and reading half the file
 * to save a millisecond would be deciding on less evidence than the file has
 * offered.
 */
export function inferDateFormat(samples: readonly DateFormatSample[]): DateFormatInference {
  let dayFirstProof: DateFormatSample | null = null;
  let monthFirstProof: DateFormatSample | null = null;
  let firstAmbiguous: DateFormatSample | null = null;
  let ambiguousCount = 0;
  let yearFirstCount = 0;

  for (const sample of samples) {
    const trimmed = sample.value.trim();
    if (!trimmed) continue;

    if (YEAR_FIRST.test(trimmed)) {
      yearFirstCount += 1;
      continue;
    }

    const twoPart = TWO_PART_THEN_YEAR.exec(trimmed);
    if (!twoPart) continue;

    const first = Number(twoPart[1]);
    const second = Number(twoPart[2]);

    if (first > 12 && second > 12) {
      // Neither position can be a month, so this cell is unreadable whichever
      // way round the column is. It proves nothing and it depends on nothing;
      // the ROW refuses, and it must not drag the whole column into a question
      // that would not change its fate.
      continue;
    }
    if (first > 12) {
      dayFirstProof = dayFirstProof ?? sample;
    } else if (second > 12) {
      monthFirstProof = monthFirstProof ?? sample;
    } else {
      // Both positions could be a month: this is a cell whose meaning genuinely
      // depends on the answer, and the only kind that does.
      ambiguousCount += 1;
      firstAmbiguous = firstAmbiguous ?? sample;
    }
  }

  if (dayFirstProof && monthFirstProof) {
    return {
      outcome: 'conflicting',
      because:
        `Line ${dayFirstProof.line} reads "${dayFirstProof.value}", which can only be day first, ` +
        `and line ${monthFirstProof.line} reads "${monthFirstProof.value}", which can only be ` +
        `month first. One file cannot be both, so nothing can be assumed about the rest.`,
      dayFirst: dayFirstProof,
      monthFirst: monthFirstProof
    };
  }

  if (dayFirstProof) {
    return {
      outcome: 'decided',
      format: 'DD/MM/YYYY',
      because:
        `Line ${dayFirstProof.line} reads "${dayFirstProof.value}" — ${dayFirstProof.value.split(/[-/.]/)[0]} ` +
        `cannot be a month, so this file writes the day first.`
    };
  }

  if (monthFirstProof) {
    return {
      outcome: 'decided',
      format: 'MM/DD/YYYY',
      because:
        `Line ${monthFirstProof.line} reads "${monthFirstProof.value}" — ` +
        `${monthFirstProof.value.split(/[-/.]/)[1]} cannot be a month, so this file writes the ` +
        `month first.`
    };
  }

  if (ambiguousCount === 0) {
    // ISO detects itself: a column of year-first cells has already answered the
    // question, so the control can say so rather than ask.
    if (yearFirstCount > 0) {
      return {
        outcome: 'decided',
        format: 'YYYY-MM-DD',
        because: 'Every date in this column starts with its year, which can only be read one way.'
      };
    }
    return {
      outcome: 'irrelevant',
      because: 'No date in this column is written in a way that could be read two ways.'
    };
  }

  // ambiguousCount > 0 is exactly the condition under which firstAmbiguous was
  // set, so the fallback below is unreachable — it exists because the compiler
  // cannot see that, and inventing a cast to tell it so would be worse.
  const example: DateFormatSample = firstAmbiguous ?? { value: '', line: 0 };
  return {
    outcome: 'ambiguous',
    because:
      `"${example.value}" on line ${example.line} could be ` +
      `${describeBothWays(example.value)}. Nothing in this file settles which, so it has to be ` +
      `said rather than guessed.`,
    example
  };
}

/** "1 June 2026 or 6 January 2026" — the same cell, read both ways round. */
export function describeBothWays(value: string): string {
  const dayFirst = parseCsvDateCell(value, 'DD/MM/YYYY');
  const monthFirst = parseCsvDateCell(value, 'MM/DD/YYYY');
  if (!dayFirst.ok || !monthFirst.ok) return value;
  return `${longDay(dayFirst.iso)} or ${longDay(monthFirst.iso)}`;
}

/**
 * "1 June 2026" — one cell under one format, spelt out.
 *
 * A worked example beside the control is the only thing that lets somebody
 * catch a transposed column at a glance; the two format NAMES look equally
 * plausible to anyone who has not just been bitten by them. Null when the cell
 * cannot be read that way at all, so the caller says nothing rather than
 * something wrong.
 */
export function describeAs(value: string, format: CsvDateFormat): string | null {
  const parsed = parseCsvDateCell(value, format);
  return parsed.ok ? longDay(parsed.iso) : null;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

/** '2026-06-01' → '1 June 2026'. Built from the digits, so no timezone touches it. */
const longDay = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
};

/**
 * The format an import will actually be read under, or null when the user has
 * to say.
 *
 * Null is the gate. It happens only under 'auto' against a file whose evidence
 * does not decide — which is precisely the case the old parser guessed at.
 */
export function resolveDateFormat(
  choice: CsvDateFormatChoice,
  inference: DateFormatInference
): CsvDateFormat | null {
  if (choice !== 'auto') return choice;
  if (inference.outcome === 'decided') return inference.format;
  // Nothing in the column depends on the answer, so any format reads it the
  // same way; the one named here never changes a value.
  if (inference.outcome === 'irrelevant') return SUGGESTED_AMBIGUOUS_FORMAT;
  return null;
}
