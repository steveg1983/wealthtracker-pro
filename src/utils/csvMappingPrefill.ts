import {
  IMPORTABLE_TRANSACTION_FIELDS,
  type ColumnMapping
} from '../services/enhancedCsvImportService';

/**
 * What happened when a saved set of columns met a real file.
 *
 * A bank template and a saved import profile are the same kind of thing: a list
 * of column names somebody wrote down against SOME file, applied to THIS one.
 * Neither can be trusted to fit, so both go through here and both report the
 * same three things.
 */
export interface PrefillOutcome {
  /** The mappings that survived: column present in the file, field importable. */
  applied: ColumnMapping[];
  /**
   * Columns the saved set names that this file does not have.
   *
   * NAMED, NEVER DROPPED. Silently discarding them is what made a template feel
   * like a button that did nothing: a Lloyds profile against a Barclays file
   * matched two columns of five and the user was shown a half-filled mapping
   * with no hint that the other three had been thrown away.
   */
  notInFile: string[];
  /**
   * Columns whose destination this app does not import at all — a running
   * balance, a share price, a quantity, a currency code. They were being
   * applied as though they meant something: a row in the mapping list, a
   * dropdown with a value, and nothing written at the end of it.
   */
  notImported: string[];
}

/**
 * Apply a saved set of columns to a file's real headers.
 *
 * Header matching is EXACT, then case- and space-insensitive as a fallback:
 * exports differ in capitalisation between a bank's own downloads ('Paid Out'
 * one month, 'Paid out' the next) and refusing on that is a distinction no user
 * can act on. Anything looser would be guessing, and a wrong column silently
 * mapped is worse than one reported missing — so a fuzzy near-match is reported
 * as not found rather than applied.
 *
 * The file's own spelling wins in the returned mapping, because the import
 * looks columns up by exact header text.
 */
export function applyMappingPrefill(
  saved: readonly ColumnMapping[],
  headers: readonly string[]
): PrefillOutcome {
  const byNormalized = new Map<string, string>();
  for (const header of headers) {
    const key = normalize(header);
    // First spelling wins: a file with two columns differing only in case keeps
    // the leftmost, which is the one a reader would point at.
    if (!byNormalized.has(key)) byNormalized.set(key, header);
  }

  const applied: ColumnMapping[] = [];
  const notInFile: string[] = [];
  const notImported: string[] = [];

  for (const mapping of saved) {
    if (!IMPORTABLE_TRANSACTION_FIELDS.includes(mapping.targetField)) {
      notImported.push(mapping.sourceColumn);
      continue;
    }

    const exact = headers.find(header => header === mapping.sourceColumn);
    const matched = exact ?? byNormalized.get(normalize(mapping.sourceColumn));
    if (matched === undefined) {
      notInFile.push(mapping.sourceColumn);
      continue;
    }

    applied.push({ ...mapping, sourceColumn: matched });
  }

  return { applied, notInFile, notImported };
}

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');
