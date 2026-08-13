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

  /**
   * What the card says about its own window at rest, or `null` for the one
   * state that says nothing.
   *
   * A card on the page's clock declares nothing, because the page bar directly
   * above it is already saying it and a label repeating that would be chrome
   * charging rent for a fact already on screen (P1). The other two states are
   * divergences from what the bar says, and a divergence has to announce
   * itself — that was the whole condition on which per-card windows were
   * allowed to exist at all.
   */
  const declaration =
    pin.source === 'own' ? `pinned · ${PERIOD_LABELS[period]}`
      : pin.source === 'partner' ? `locked · ${pin.partnerLabel ?? ''}`
        : null;

  /**
   * The same fact, spoken. The marker reads `pinned · All time` because a
   * middle dot is how this app joins a label to its value in a tight space; a
   * screen reader saying "pinned middle-dot All time" is not that fact, it is
   * the typography of it. So the sentence is written out.
   */
  const spokenState =
    pin.source === 'own' ? `pinned to ${PERIOD_LABELS[period]}`
      : pin.source === 'partner' ? `locked to ${pin.partnerLabel ?? ''}`
        : null;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const menuId = `${useId()}-card-period`;

  /**
   * True from the moment a pointer goes down INSIDE this control until the
   * click it belongs to has been delivered.
   *
   * ── WHY A FLAG AND NOT A SMARTER `relatedTarget` TEST ───────────────────────
   *
   * A menu item was unclickable with a real mouse and perfectly clickable with
   * `element.click()`. That difference is the whole diagnosis: `.click()` fires
   * one event, while a physical click fires pointerdown → mousedown → a focus
   * change → mouseup → click. Something in the early phase was dismissing the
   * menu, so by the time `click` arrived React had already unmounted the item
   * it was aimed at. Instrumented in the owner's own Safari: the synthetic
   * click set `pinned to All time` and wrote the keys; his mouse did nothing at
   * all, four cards still reading "period follows the page".
   *
   * The previous attempt guessed at WHICH focus target Safari reports during
   * that phase (`null`, then also `document.body`) and guessed wrong twice.
   * This stops guessing. If a pointer went down inside this control, whatever
   * focus does next is part of that interaction and is not a departure —
   * regardless of what any engine names as the thing being focused.
   *
   * Genuine departures are untouched: Tab moves focus with no pointer down, and
   * a click outside never sets the flag and is caught by the mousedown listener
   * below, which is where outside clicks have always been handled.
   */
  const pointerInside = useRef(false);

  useEffect(() => {
    // Cleared on the window, not the control: a press that starts inside and
    // releases anywhere — including outside, or off the edge of the screen —
    // still has to end, or the flag would stay raised and the menu would stop
    // dismissing on blur for good.
    const release = (): void => { pointerInside.current = false; };
    window.addEventListener('pointerup', release);
    window.addEventListener('mouseup', release);
    window.addEventListener('touchend', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('mouseup', release);
      window.removeEventListener('touchend', release);
    };
  }, []);

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
      onPointerDown={() => { pointerInside.current = true; }}
      onMouseDown={() => { pointerInside.current = true; }}
      onTouchStart={() => { pointerInside.current = true; }}
      onBlur={(event) => {
        /**
         * Tabbing out dismisses. A CLICK MUST NOT — and on Safari those arrive
         * as the same event.
         *
         * Safari does not focus a `<button>` when you click it: WebKit follows
         * the platform convention that only text fields take focus from a
         * click. So pressing a menu item moved focus off the item this control
         * had focused on opening, this handler read that as a departure, the
         * menu closed on MOUSEDOWN, and the `click` that followed landed on an
         * element React had already removed. Every period was unselectable.
         *
         * Two earlier attempts guessed at what Safari names as the new focus
         * target — first `null`, then also `document.body` — and both were
         * wrong, which is how this survived being "fixed" twice. The pointer
         * flag replaces the guess with a fact: if a press started inside this
         * control, whatever focus does next belongs to that press.
         *
         * Chromium focuses clicked buttons, so it worked there throughout —
         * including in every browser we can automate, which is exactly why only
         * the owner could see it.
         */
        if (pointerInside.current) return;
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
        aria-label={spokenState === null
          ? `${cardLabel}: period follows the page. Pin this card to its own period`
          : `${cardLabel}: ${spokenState}. Choose a different period for this card`}
        className="flex items-center rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200 transition-colors duration-state"
      >
        {declaration === null ? (
          <CalendarIcon size={14} aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            data-pin-marker
            // The blink that says "the page moved and I did not" — see
            // hooks/useCardPeriod's `justHeld`. The element clears it itself
            // when the animation ends, so nothing here needs a timer.
            className={`text-label whitespace-nowrap ${pin.justHeld ? 'animate-pin-ack' : ''}`}
            onAnimationEnd={pin.onHeldShown}
          >
            {declaration}
          </span>
        )}
      </button>

      {/*
        The "Follow page" button was here, beside the marker. It has gone into
        the MENU as "Default", because a card had two ways back to the page
        clock and neither was where you would look: this button only appeared
        once you had already pinned, so the menu — the thing you open to choose
        a window — never listed the window most cards are on. The owner asked
        for exactly that entry. One control, holding every choice it governs.
      */}

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Window for ${cardLabel}`}
          className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] rounded border border-line dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-overlay"
        >
          {/* DEFAULT FIRST, and it is not a window — it is the absence of a
              choice, which is where every card starts and the state most of
              them are in. Listing it alongside the windows is what makes this
              menu the complete answer to "what is this card reading over?"
              rather than a list of ways to leave the default behind. */}
          <button
            ref={firstItemRef}
            type="button"
            role="menuitemradio"
            aria-checked={pin.source === 'page'}
            onClick={() => { pin.follow(); close(); }}
            className={`flex w-full items-center px-3 py-1.5 text-left text-body transition-colors duration-state hover:bg-surface-secondary dark:hover:bg-gray-700 focus:outline-none focus-visible:bg-surface-secondary dark:focus-visible:bg-gray-700 ${
              pin.source === 'page'
                ? 'font-medium text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            Default
          </button>

          {/* The lock, when this card has a partner ON the dashboard. Directly
              under Default because it is the same kind of answer — "take your
              window from somewhere else" — and above the windows, which are the
              answers that end the question here. */}
          {pin.partnerLabel !== undefined && (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={pin.source === 'partner'}
              onClick={() => { pin.lockToPartner(); close(); }}
              className={`flex w-full items-center px-3 py-1.5 text-left text-body transition-colors duration-state hover:bg-surface-secondary dark:hover:bg-gray-700 focus:outline-none focus-visible:bg-surface-secondary dark:focus-visible:bg-gray-700 ${
                pin.source === 'partner'
                  ? 'font-medium text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Locked to {pin.partnerLabel}
            </button>
          )}

          <div role="separator" className="my-1 border-t border-line dark:border-gray-700" />

          {PINNABLE_PERIODS.map((key) => (
            <button
              key={key}
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
