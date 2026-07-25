/**
 * Excel, Sheets and LibreOffice evaluate any cell whose text begins with one of
 * these, so an attacker-controlled field (a connection `error`, an admin-typed
 * `reason`) can become a live formula in the auditor's spreadsheet — reading
 * other cells, or in the =HYPERLINK/WEBSERVICE case exfiltrating them. Leading
 * tab and CR are included because spreadsheets strip them before deciding.
 */
const FORMULA_TRIGGER_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Quote a value for CSV output and defuse spreadsheet formula injection.
 *
 * The leading apostrophe is the conventional neutraliser: spreadsheets treat
 * the rest of the cell as literal text and do not display it.
 */
export const escapeCsv = (value: string): string => {
  const neutralized = FORMULA_TRIGGER_PREFIXES.includes(value.charAt(0)) ? `'${value}` : value;
  if (!/[",\n\r]/.test(neutralized)) {
    return neutralized;
  }
  return `"${neutralized.replace(/"/g, '""')}"`;
};
