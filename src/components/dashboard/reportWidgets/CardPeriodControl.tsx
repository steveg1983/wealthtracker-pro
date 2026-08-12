import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarIcon } from '../../icons';
import { PERIOD_LABELS, type PeriodKey } from '../../../hooks/usePeriod';
import type { CardPeriodPin } from '../../../hooks/useCardPeriod';

/**
 * One card's period affordance: the way to pin it to a window of its own, and —
 * once pinned — the declaration that it has been.
 *
 * ── WHAT IS VISIBLE WHEN ────────────────────────────────────────────────────
 *
 * AT REST, on an unpinned card, nothing. P1 charges chrome rent, and a card
 * obeying the page clock has nothing to say that the bar under the heading is
 * not already saying for the whole page. The trigger fades in on hover or when
 * focus enters the card — the same idiom the Accounts page's row actions use,
 * including the `hover:hover` guard that keeps it permanently visible on a
 * touch screen, where there is no hover to reveal it with.
 *
 * PINNED, always: `pinned · All time`, in the label voice, in the same grey as
 * every other secondary line on the card. NOT amber (P3): a card reading over a
 * window the user deliberately chose is not a warning, and colouring it as one
 * would spend the only colour the page has for things that are actually wrong.
 * Beside it, the release — one tap, named for what it does rather than for
 * undoing what was done.
 *
 * ── WHY THE MENU OFFERS NO CUSTOM RANGE ─────────────────────────────────────
 *
 * Five windows, not the bar's six. A custom range is a statement about what the
 * whole page is being read over and comes with two date fields to say it; a pin
 * is the narrower claim *"this lens wants a different standard window from that
 * one"*. Nothing stops the page bar from being set to a custom range — a pinned
 * card simply cannot be the thing that asks for one.
 */

/** The windows a card can be pinned to, in the page bar's own order. */
const PINNABLE_PERIODS: PeriodKey[] = [
  'this-month',
  'last-month',
  'tax-year',
  'last-12-months',
  'all',
];

/**
 * Hidden until the card is hovered or holds focus. `group/card` is on the card
 * shell; the `hover:hover` guard is what keeps it visible on a touch screen.
 */
const QUIET_AT_REST =
  'transition-opacity duration-state [@media(hover:hover)]:group-[:not(:hover):not(:focus-within)]/card:opacity-0';

export default function CardPeriodControl({ cardLabel, period, pin }: {
  /** What this control governs, for anyone who cannot see which card it is on. */
  cardLabel: string;
  /** The window the card is on right now — the page's, or its own. */
  period: PeriodKey;
  pin: CardPeriodPin;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const menuId = `${useId()}-card-period`;

  // Clicking anywhere else dismisses — mousedown, so the click that opens
  // another control is not swallowed by this menu closing first.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Opening puts the keyboard on the first window, so the list is reachable
  // without tabbing back through the trigger.
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  const close = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (key: PeriodKey): void => {
    pin.pinTo(key);
    close();
  };

  return (
    <div
      ref={containerRef}
      className={`relative ml-auto flex shrink-0 items-center gap-1.5 ${
        pin.isPinned || open ? '' : QUIET_AT_REST
      }`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
      onBlur={(event) => {
        // Tabbing out dismisses; a click on the menu's own padding blurs to
        // nothing at all, and must NOT.
        const next = event.relatedTarget;
        if (next instanceof Node && !containerRef.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // The visible text is the DECLARATION, which is a statement rather than
        // an instruction, so the control still has to say what it is for.
        aria-label={pin.isPinned
          ? `${cardLabel}: pinned to ${PERIOD_LABELS[period]}. Choose a different period for this card`
          : `${cardLabel}: period follows the page. Pin this card to its own period`}
        className="flex items-center rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200 transition-colors duration-state focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {pin.isPinned ? (
          <span
            aria-hidden="true"
            data-pin-marker
            // The blink that says "the page moved and I did not" — see
            // hooks/useCardPeriod's `justHeld`. The element clears it itself
            // when the animation ends, so nothing here needs a timer.
            className={`text-label whitespace-nowrap ${pin.justHeld ? 'animate-pin-ack' : ''}`}
            onAnimationEnd={pin.onHeldShown}
          >
            pinned · {PERIOD_LABELS[period]}
          </span>
        ) : (
          <CalendarIcon size={14} aria-hidden="true" />
        )}
      </button>

      {pin.isPinned && (
        <button
          type="button"
          onClick={pin.follow}
          aria-label={`${cardLabel}: follow the page period`}
          className="rounded px-1.5 py-0.5 text-label whitespace-nowrap text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200 transition-colors duration-state focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Follow page
        </button>
      )}

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Window for ${cardLabel}`}
          className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] rounded border border-line dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-overlay"
        >
          {PINNABLE_PERIODS.map((key, index) => (
            <button
              key={key}
              ref={index === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitemradio"
              aria-checked={pin.isPinned && period === key}
              onClick={() => choose(key)}
              className={`flex w-full items-center px-3 py-1.5 text-left text-body transition-colors duration-state hover:bg-surface-secondary dark:hover:bg-gray-700 focus:outline-none focus-visible:bg-surface-secondary dark:focus-visible:bg-gray-700 ${
                pin.isPinned && period === key
                  ? 'font-medium text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {PERIOD_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
