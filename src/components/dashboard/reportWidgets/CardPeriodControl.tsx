import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarIcon } from '../../icons';
import DatePicker from '../../common/DatePicker';
import { PERIOD_LABELS, type PeriodKey, type UsePeriodResult } from '../../../hooks/usePeriod';
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
 * ── THE CUSTOM RANGE ────────────────────────────────────────────────────────
 *
 * All six windows, including Custom — which this deliberately did NOT offer at
 * first, on the reasoning that a custom range is a statement about what the
 * whole page is being read over, while a pin is the narrower claim "this lens
 * wants a different standard window from that one".
 *
 * The owner asked for it, and the argument does not survive his use of it: he
 * reads net worth over all time and one flow chart over a quarter he cares
 * about, and "a quarter he cares about" is not one of the five standard
 * windows. A card that can hold any window except the one you want is a card
 * that sends you back to the page bar, which moves every OTHER card too — the
 * exact problem the pin exists to solve.
 *
 * The two date fields live in the menu rather than on the card face, because
 * the card face is a subtitle row with a chart under it and no room for a pair
 * of inputs. Choosing Custom therefore does not close the menu: the choice is
 * not finished until the dates are in, and closing on the click would ask the
 * user to reopen the menu to complete what they just started.
 */

/** The windows a card can be pinned to, in the page bar's own order. */
const PINNABLE_PERIODS: PeriodKey[] = [
  'this-month',
  'last-month',
  'tax-year',
  'last-12-months',
  'all',
  'custom',
];

/**
 * VISIBLE AT REST — it used to hide until the card was hovered.
 *
 * That was the same hover-reveal the row actions on the Accounts page wore, and
 * it failed here for the same reason and worse. The owner reported that he
 * "still cannot change the date viewings on the charts": the pins worked, the
 * menu worked, and the control that opens it was invisible until a mouse
 * happened to pass over the card. A control nobody can see is a feature nobody
 * has — and unlike the row actions, this one has no second route to it
 * anywhere in the app.
 *
 * It is a 16px calendar glyph in the card's own quiet grey, which is what P1
 * asks of chrome: small, not absent. And it settles a related awkwardness —
 * the design ruling required a PINNED card to declare itself at rest, so the
 * declaration was permanent while the control that produced it was not: a
 * state you could see but not reach.
 */
const QUIET_AT_REST = 'transition-opacity duration-state';

export default function CardPeriodControl({ cardLabel, picker, pin }: {
  /** What this control governs, for anyone who cannot see which card it is on. */
  cardLabel: string;
  /**
   * The window the card is read over — the page's picker when it follows, its
   * own when pinned. The WHOLE picker rather than just the key, because a
   * custom range is two dates as well as a name, and the control that offers
   * Custom has to be the control that can set them.
   */
  picker: UsePeriodResult;
  pin: CardPeriodPin;
}): React.JSX.Element {
  const { period, customStart, customEnd, setCustomStart, setCustomEnd } = picker;
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
    // Custom is not finished at the click — its two dates are in the panel
    // below, so the panel stays. Every other window is complete on choosing.
    if (key !== 'custom') close();
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
        /**
         * Tabbing out dismisses. A CLICK MUST NOT — and on Safari that is the
         * same event.
         *
         * THE BUG THIS FIXES, because it cost the owner two days of a feature
         * that looked completely finished: Safari (macOS and iOS) does not
         * focus a `<button>` when you click it. WebKit follows the platform
         * convention that only text fields take focus from a click. So a
         * mousedown on one of the menu items below moves focus off the item
         * this effect just focused and onto `<body>` — and `document.body` is
         * a `Node` that this container does not contain. The old test passed,
         * the menu closed on MOUSEDOWN, React unmounted the item, and the
         * `click` that followed landed on nothing. Every period in the menu was
         * unselectable: the menu opened, dismissed itself, and the chart never
         * moved. Chromium focuses clicked buttons, so it worked perfectly in
         * every browser we had automated — which is exactly why it survived.
         *
         * `relatedTarget` of `body` means "focus went nowhere", which is a
         * click, not a departure. Genuine departures — Tab, or a click landing
         * on some other control — name that control, and still close. A click
         * on empty space outside is caught by the mousedown listener above,
         * which is where outside-clicks were always handled anyway.
         */
        const next = event.relatedTarget;
        if (next === null || next === document.body) return;
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
        className="flex items-center rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200 transition-colors duration-state"
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
          className="rounded px-1.5 py-0.5 text-label whitespace-nowrap text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200 transition-colors duration-state"
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

          {pin.isPinned && period === 'custom' && (
            /* The dates for the window just chosen. Inside the menu because the
               card face has a chart under it and nowhere to put a pair of
               inputs; under a rule because they answer the choice above rather
               than being a sixth choice beside it.

               `DatePicker` rather than a bare `type="date"`: a native date
               input renders in the BROWSER's locale, and this app is dd/mm/yyyy
               throughout regardless of what machine it is on. Same component,
               same reason, as the page bar's own custom range. */
            <div className="mt-1 border-t border-line dark:border-gray-700 px-3 pb-2 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-32">
                  <DatePicker
                    size="sm"
                    value={customStart}
                    onChange={setCustomStart}
                    aria-label={`${cardLabel}: custom period start date`}
                    className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <span className="text-label text-gray-500 dark:text-gray-400">to</span>
                <div className="w-32">
                  <DatePicker
                    size="sm"
                    value={customEnd}
                    onChange={setCustomEnd}
                    aria-label={`${cardLabel}: custom period end date`}
                    className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              {/* An unbounded end is a real answer ("from March onwards"), so
                  neither field is required and neither is nagged about. */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
