import { describe, it, expect } from 'vitest';
import {
  DATE_CELL_TEXT_PX,
  DATE_COLUMN_WIDTH_PX,
  DATE_FIELD_SHELL_INSET_PX,
  DATE_FIELD_TEXT_PX,
  DATE_INPUT_INSET_PX,
  DATE_TEXT_COMFORT_PX,
  TABLE_CELL_INSET_PX,
  dateCellTextBudgetPx,
  dateFieldTextBudgetPx,
  minimumDateColumnWidthPx,
} from '../registerDateColumn';

/**
 * The register shipped a Date column that cut the last digit off the year, and
 * the reason it survived review is that nothing anywhere could be asked "does
 * a date fit?".
 *
 * jsdom cannot answer that either — it has no layout and no fonts, so it will
 * cheerfully report every element as 0px wide. What it CAN do is hold the
 * arithmetic to account: the text widths were measured off Inter's own metrics
 * (see the module), and everything between the column edge and the text is a
 * number written down. This file checks the sum, and the register's own test
 * checks that the class names those numbers describe are still the ones on the
 * page. Between them, moving any term breaks a test.
 *
 * That a real browser then draws it comfortably is the owner's eye to confirm.
 */

describe('the register’s Date column — will a date fit?', () => {
  it('gives the editing field its widest string plus room to spare', () => {
    // "dd/mm/yyyy" — the placeholder, wider than any real date in Inter's
    // proportional figures, and the thing an empty field has to show.
    expect(dateFieldTextBudgetPx(DATE_COLUMN_WIDTH_PX))
      .toBeGreaterThanOrEqual(DATE_FIELD_TEXT_PX + DATE_TEXT_COMFORT_PX);
  });

  it('gives the read-only cell its widest date plus room to spare — in bold', () => {
    // The highlighted row is font-weight 600, and Inter's bold digits are wider.
    expect(dateCellTextBudgetPx(DATE_COLUMN_WIDTH_PX))
      .toBeGreaterThanOrEqual(DATE_CELL_TEXT_PX + DATE_TEXT_COMFORT_PX);
  });

  it('is wider than the narrowest column a date survives', () => {
    expect(DATE_COLUMN_WIDTH_PX).toBeGreaterThanOrEqual(minimumDateColumnWidthPx());
  });

  it('would have failed at the 100px the column shipped at', () => {
    // The bug, stated as the arithmetic that caused it: 78px of text budget for
    // 84px of "dd/mm/yyyy" — about the width of one digit short, which is
    // exactly what the owner saw missing off the end of the year.
    expect(dateFieldTextBudgetPx(100)).toBe(78);
    expect(dateFieldTextBudgetPx(100)).toBeLessThan(DATE_FIELD_TEXT_PX);
    expect(100).toBeLessThan(minimumDateColumnWidthPx());
  });

  it('takes the field’s insets off instead of the cell’s, not as well as', () => {
    // The field's shell cancels the cell padding (-mx-3) and puts its own back,
    // so the two are alternatives. Adding them would under-report the field's
    // room by 24px and send someone hunting for pixels that were never lost.
    expect(dateFieldTextBudgetPx(DATE_COLUMN_WIDTH_PX))
      .toBe(DATE_COLUMN_WIDTH_PX - DATE_FIELD_SHELL_INSET_PX - DATE_INPUT_INSET_PX);
    expect(dateCellTextBudgetPx(DATE_COLUMN_WIDTH_PX))
      .toBe(DATE_COLUMN_WIDTH_PX - TABLE_CELL_INSET_PX);
    // The field, with its slimmer insets, ends up with MORE room than the cell
    // — which is the whole reason the shell eats the cell's padding.
    expect(dateFieldTextBudgetPx(DATE_COLUMN_WIDTH_PX))
      .toBeGreaterThan(dateCellTextBudgetPx(DATE_COLUMN_WIDTH_PX));
  });
});
