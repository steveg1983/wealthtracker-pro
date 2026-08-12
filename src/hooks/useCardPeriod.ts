import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cardPeriodPreferenceKeys,
  periodPinKey,
  preferences,
} from '../services/preferencesService';
import { usePeriod, type PeriodKey, type PeriodStorage, type UsePeriodResult } from './usePeriod';

/**
 * A dashboard card's period, and whether it is the page's or its own.
 *
 * ── WHY A CARD MAY DIVERGE AT ALL ───────────────────────────────────────────
 *
 * The page-level clock is the law (DESIGN_RULINGS_2026-08-12 §C's sibling
 * ruling, and components/PeriodBar's header): one control, under the heading,
 * governing everything below it, because three identically-styled pickers feet
 * apart declared nothing about what each covered.
 *
 * That ruling stands, and the owner then hit its cost in practice. Net worth is
 * a STOCK — what you are worth, and its natural window is forever. Income
 * against expenses is a FLOW — what moved, and its natural window is a period.
 * Reading the first over all time forced the second over all time too, which is
 * not a longer answer to the same question, it is a different question nobody
 * asked. The two cards are different lenses and a single clock made them one.
 *
 * So a card may be PINNED to a window of its own — and the crime the original
 * ruling was written against was never divergence, it was UNDECLARED scope. A
 * pinned card therefore says so, out loud, permanently, on its own face
 * ("pinned · All time"), with the release one tap away. An unpinned card is
 * handed the page's picker itself, so "follows the page" is not a rule this
 * module keeps — it is the same object.
 *
 * ── WHERE THE PIN LIVES ─────────────────────────────────────────────────────
 *
 * Nowhere new. A pinned card is an ordinary period surface: `usePeriod` with a
 * storage key of its own, writing the same four strings it has always written,
 * through the same preferences document that carries the page's own choice —
 * so the pin travels with the ACCOUNT, survives a restore, and reaches the
 * desktop edition without this file naming an edition (services/preferencesService
 * reaches its store through `@prefs-store`).
 *
 * The one addition is a fifth key, the pin flag itself
 * (services/preferencesService `periodPinKey`). It is what lets a card be
 * released without inventing a way to un-choose a period, which `usePeriod`
 * deliberately does not have and which every other surface would have had to
 * grow a field for.
 *
 * ── A USER WITH NO PINS ─────────────────────────────────────────────────────
 *
 * Reads three keys that are not there, writes nothing, and is handed the page's
 * picker unchanged. There is no migration because there is no old shape: the
 * keys below did not exist before, and their absence is the answer "follows the
 * page" — which is what every stored dashboard already meant. Pinned in
 * hooks/__tests__/useCardPeriod.test.ts.
 */

/** Whether this card has a window of its own, and the two ways to change that. */
export interface CardPeriodPin {
  /** True when the card is being read over its own window, not the page's. */
  isPinned: boolean;
  /** Pin the card to `key`. Pinning IS choosing, so it persists. */
  pinTo: (key: PeriodKey) => void;
  /** Give the card back to the page clock, and forget it was ever pinned. */
  follow: () => void;
  /**
   * True from the moment the PAGE clock moves under a pinned card until the
   * card has acknowledged it.
   *
   * A pinned card holding still while the whole page moves around it is
   * indistinguishable, at a glance, from a card that is broken. So the marker
   * blinks once — the user sees the page move AND sees this card deliberately
   * decline to. An acknowledgement, not an alarm: no colour, no movement, once.
   */
  justHeld: boolean;
  /** Called by the marker when the acknowledgement has played out. */
  onHeldShown: () => void;
}

export interface CardPeriod {
  /**
   * The window the card is actually read over — the page's picker itself when
   * unpinned, the card's own when pinned.
   *
   * ONE object, deliberately: the window a card DRAWS and the window its
   * click-through CARRIES have to be the same one, and a second prop saying
   * nearly the same thing is how those two drift (the rule
   * ImprovedDashboard.test.tsx already states about `picker`).
   */
  picker: UsePeriodResult;
  pin: CardPeriodPin;
}

/**
 * Where one card's pin is filed, derived from the PAGE's key so the relationship
 * is visible in storage rather than inferred: `dashboardReports.pin.net-worth`
 * beside `dashboardReports`.
 */
export const cardPeriodKey = (pageKey: string, cardId: string): string =>
  `${pageKey}.pin.${cardId}`;

export function useCardPeriod(
  storageKey: string,
  page: UsePeriodResult,
  storage: PeriodStorage = preferences
): CardPeriod {
  /**
   * The card's own surface. Its `defaultKey` is the page's current window, and
   * it is never seen: an unpinned card is handed `page` below, and a pin always
   * arrives through `pinTo` with a window the user just picked. The default
   * matters only for a hand-edited store that says "pinned" without saying to
   * what, where following the page is the sane reading.
   */
  const own = usePeriod(storageKey, page.period, storage);
  const { setPeriod: setOwnPeriod } = own;

  const [isPinned, setIsPinned] = useState<boolean>(
    () => storage.getItem(periodPinKey(storageKey)) === 'true'
  );

  const pinTo = useCallback((key: PeriodKey): void => {
    setOwnPeriod(key);
    storage.setItem(periodPinKey(storageKey), 'true');
    setIsPinned(true);
  }, [setOwnPeriod, storage, storageKey]);

  /**
   * The page window this card last saw.
   *
   * `page.range` rather than `page.period`, because editing the bounds of a
   * custom range moves the page's window without changing its name — and a
   * pinned card has just as deliberately not followed that. The range object's
   * identity is memoised on exactly the three things that define the window, so
   * it changes when the window does and not once more (see usePeriod).
   */
  const [justHeld, setJustHeld] = useState(false);
  const lastPageRange = useRef(page.range);

  useEffect(() => {
    if (lastPageRange.current === page.range) return;
    lastPageRange.current = page.range;
    // Only a card that HELD has anything to acknowledge. An unpinned card
    // followed, which the figures redrawing already says.
    if (isPinned) setJustHeld(true);
  }, [page.range, isPinned]);

  const onHeldShown = useCallback((): void => setJustHeld(false), []);

  const follow = useCallback((): void => {
    setIsPinned(false);
    setJustHeld(false);
    // Every key this card owns, not just the flag: a released card left a
    // window behind in the document, and a document that grows a line per card
    // the user has ever experimented with is a document that never shrinks.
    // `own` keeps its last value in memory and nothing can read it — an
    // unpinned card is handed `page`, and re-pinning arrives with a window of
    // its own.
    for (const key of cardPeriodPreferenceKeys(storageKey)) storage.removeItem(key);
  }, [storage, storageKey]);

  return {
    picker: isPinned ? own : page,
    pin: { isPinned, pinTo, follow, justHeld, onHeldShown },
  };
}
