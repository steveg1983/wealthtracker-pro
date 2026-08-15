import React from 'react';
import { formatCurrency, formatCurrencyForSpeech } from '../../utils/currency-decimal';
import type { DecimalInstance } from '../../utils/decimal';

/**
 * AN AMOUNT, SEEN AND HEARD.
 *
 * Negative amounts render `(£417.54)` (Claude Design, 15 August). That fixes a
 * real problem — sign had exactly one carrier, a four-pixel minus glyph, and
 * colour was doing the rest of the work for anyone who could see colour.
 *
 * It also creates one, which is why this component exists: **screen readers at
 * default punctuation verbosity do not announce brackets.** `-£417.54` is
 * spoken "minus four hundred and seventeen…"; `(£417.54)` is spoken "four
 * hundred and seventeen…". Shipping the parentheses without this would take
 * the sign away from precisely the readers the change is meant to help — the
 * greyscale, low-vision and colour-blind readers named in the ruling.
 *
 * So the visible text and the accessible name are produced separately and
 * neither is derived from the other's string.
 *
 * ─ THE COLUMN ──────────────────────────────────────────────────────────────
 *
 * A closing bracket is about half a character wide, so a right-aligned column
 * of mixed signs stops aligning on the decimal point — positives sit one
 * bracket further right than negatives. `reserveBracket` puts an invisible,
 * aria-hidden `)` after positive amounts so every row ends on the same column.
 * It is opt-in because it is only right inside a numeric column: in running
 * prose it would add a space to the end of a sentence.
 */
interface AmountProps {
  value: DecimalInstance | number;
  currency?: string;
  className?: string;
  /**
   * Pad positives with an invisible closing bracket so a right-aligned column
   * keeps its decimal points in line. Use in tables and registers; leave off
   * in a sentence.
   */
  reserveBracket?: boolean;
  /** Rendered as a <span> unless something else is needed (td, etc.). */
  as?: 'span' | 'div' | 'td';
}

export default function Amount({
  value,
  currency = 'GBP',
  className = '',
  reserveBracket = false,
  as: Tag = 'span'
}: AmountProps): React.JSX.Element {
  const visible = formatCurrency(value, currency);
  const spoken = formatCurrencyForSpeech(value, currency);
  const isNegative = visible.startsWith('(');

  return (
    <Tag className={className} aria-label={spoken}>
      {/* aria-hidden on the VISIBLE half: the label above is what is announced,
          and without this a screen reader would read the amount twice. */}
      <span aria-hidden="true">{visible}</span>
      {reserveBracket && !isNegative && (
        <span aria-hidden="true" className="invisible">)</span>
      )}
    </Tag>
  );
}
