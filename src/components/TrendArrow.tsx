import React from 'react';
import { TrendingUpIcon, TrendingDownIcon } from './icons';

/**
 * The direction beside a figure — and the ONE component that decides when a
 * direction may render at all.
 *
 * The rule it holds (Claude Design, 16 Aug, restated 22 Aug when it turned out
 * to have been copied rather than shared): a zero has no direction, so at zero
 * — or with nothing to measure — NOTHING renders. It took four surfaces
 * re-deriving this by hand (the dashboard pair got it right, Budget's copies
 * didn't, Investments' Return % wore a hard-coded down arrow beside a positive
 * figure) before the rule got a home. New cards call this; they do not write
 * their own conditional.
 *
 * Two kinds of direction, one prop apart:
 *  - omit `direction` and the arrow follows the SIGN of the figure it sits
 *    with — up and green for a gain, down and red for a loss. An arrow that
 *    disagrees with its own figure's sign is answering a question the card
 *    doesn't ask.
 *  - pass `direction` for a FLOW arrow (income up, expenses down), where the
 *    glyph names which way money moves and only the zero rule applies. These
 *    exist because the owner asked for them by name on the dashboard pair.
 */

/** The one shape of Decimal this component needs to read a sign from. */
interface SignReadable {
  isZero(): boolean;
  greaterThan(n: number): boolean;
}

interface TrendArrowProps {
  /** The figure the arrow sits with. null, undefined or zero renders nothing. */
  value: number | SignReadable | null | undefined;
  /** Fixed flow direction. Omitted, the arrow follows the value's sign. */
  direction?: 'up' | 'down';
  size?: number;
  className?: string;
}

const isZeroValue = (value: number | SignReadable): boolean =>
  typeof value === 'number' ? value === 0 : value.isZero();

const isPositive = (value: number | SignReadable): boolean =>
  typeof value === 'number' ? value > 0 : value.greaterThan(0);

export default function TrendArrow({
  value,
  direction,
  size = 24,
  className = '',
}: TrendArrowProps): React.JSX.Element | null {
  if (value === null || value === undefined || isZeroValue(value)) return null;

  const up = direction ? direction === 'up' : isPositive(value);
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  const colour = up ? 'text-green-500' : 'text-red-500';

  return (
    <Icon
      size={size}
      className={`${colour} flex-shrink-0 ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
