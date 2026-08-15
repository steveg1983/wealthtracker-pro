/**
 * NEGATIVES WEAR PARENTHESES — and the sign survives without colour.
 *
 * Claude Design's ruling of 15 August: `(£417.54)`, not `−£417.54`, because
 * sign had exactly one carrier and it was a four-pixel glyph propped up by
 * colour. The test they asked for is the one that matters:
 *
 *   "assert the sign is recoverable WITHOUT colour … that's the shape of test
 *    that would have caught the text-red-600 dark-mode bug — assert the
 *    meaning survives, not that a class is present."
 *
 * So nothing here asserts a class. It asserts that a reader who cannot see
 * colour can still tell owing from owning, by eye AND by ear.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatCurrency, formatCurrencyForSpeech } from '../currency-decimal';
import { toDecimal } from '../decimal';
import Amount from '../../components/common/Amount';

describe('the sign is recoverable without colour', () => {
  it('brackets a negative and leaves a positive bare', () => {
    expect(formatCurrency(-417.54)).toBe('(£417.54)');
    expect(formatCurrency(417.54)).toBe('£417.54');
  });

  it('never prints both a bracket and a minus', () => {
    const negative = formatCurrency(-2345.67);
    expect(negative).toBe('(£2,345.67)');
    expect(negative).not.toContain('-');
    expect(negative).not.toContain('−');
  });

  it('keeps the symbol inside the brackets, per the convention', () => {
    // `(£417.54)`, not `£(417.54)` and not `(417.54)£`.
    expect(formatCurrency(-417.54).indexOf('£')).toBe(1);
  });

  it('leaves zero alone — a day that nets out is not a debt', () => {
    expect(formatCurrency(0)).toBe('£0.00');
    expect(formatCurrency(-0)).toBe('£0.00');
    // The negative that rounds away: -0.004 is negative and prints as 0.00.
    expect(formatCurrency(-0.004)).toBe('£0.00');
  });

  it('wraps the whole thing for a suffix currency', () => {
    // CHF puts its symbol after the figure, so the brackets take both.
    expect(formatCurrency(-417.54, 'CHF')).toBe('(417.54 CHF)');
    expect(formatCurrency(417.54, 'CHF')).toBe('417.54 CHF');
  });

  it('groups thousands inside the brackets', () => {
    expect(formatCurrency(-1234567.89)).toBe('(£1,234,567.89)');
  });

  it('accepts a Decimal as readily as a number', () => {
    expect(formatCurrency(toDecimal('-8802.57'))).toBe('(£8,802.57)');
  });
});

describe('the accessible name does not degrade', () => {
  /*
   * The half of this change that could have made things WORSE. Screen readers
   * at default punctuation verbosity do not announce brackets, so a naive
   * swap would have removed the sign for exactly the readers — greyscale,
   * low-vision, colour-blind — the ruling names as the reason for it.
   */
  it('says "minus" out loud where the eye sees a bracket', () => {
    expect(formatCurrencyForSpeech(-417.54)).toBe('minus £417.54');
    expect(formatCurrencyForSpeech(417.54)).toBe('£417.54');
  });

  it('does not say minus for a zero that happens to be signed', () => {
    expect(formatCurrencyForSpeech(-0.004)).toBe('£0.00');
  });

  it('gives <Amount> an accessible name that states the sign', () => {
    render(<Amount value={-417.54} />);

    // What a screen reader reaches for…
    expect(screen.getByLabelText('minus £417.54')).toBeInTheDocument();
    // …and what the eye sees, which is NOT what is announced.
    expect(screen.getByLabelText('minus £417.54').textContent).toContain('(£417.54)');
  });

  it('does not announce the amount twice', () => {
    const { container } = render(<Amount value={-417.54} />);
    // The visible half is aria-hidden precisely so the label is the only voice.
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('(£417.54)');
  });
});

describe('the column still lines up', () => {
  /*
   * Design's first thing-to-check: brackets are wider than a minus, so a
   * right-aligned column of mixed signs stops aligning on the decimal point.
   * The accounting fix is to reserve the closing-bracket column on every row.
   */
  it('pads a positive with an invisible closing bracket when asked', () => {
    const { container } = render(<Amount value={417.54} reserveBracket />);
    const hidden = [...container.querySelectorAll('.invisible')];

    expect(hidden).toHaveLength(1);
    expect(hidden[0].textContent).toBe(')');
    expect(hidden[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('does not pad a negative, which brings its own bracket', () => {
    const { container } = render(<Amount value={-417.54} reserveBracket />);
    expect(container.querySelectorAll('.invisible')).toHaveLength(0);
  });

  it('pads nothing unless asked, since prose is not a column', () => {
    const { container } = render(<Amount value={417.54} />);
    expect(container.querySelectorAll('.invisible')).toHaveLength(0);
  });

  it('keeps the padding out of the accessible name', () => {
    render(<Amount value={417.54} reserveBracket />);
    expect(screen.getByLabelText('£417.54')).toBeInTheDocument();
  });
});

describe('what this must NOT reach', () => {
  it('leaves the CSV exporter alone', async () => {
    // Parentheses are a display convention. A file that gets parsed keeps the
    // minus, which is the same distinction as the ≈ marker: how a number is
    // read, not what the number is.
    const { exportTransactionsToCSV } = await import('../csvExport');
    const csv = exportTransactionsToCSV(
      [{
        id: 't1', accountId: 'a1', amount: -417.54, date: new Date('2026-08-15'),
        description: 'Shop', category: 'c1', type: 'expense', cleared: false
      }] as never,
      [{ id: 'a1', name: 'Current' }] as never,
      [{ id: 'c1', name: 'Groceries' }] as never
    );

    expect(csv).toContain('-417.54');
    expect(csv).not.toContain('(417.54)');
  });
});
