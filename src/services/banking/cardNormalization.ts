import Decimal from 'decimal.js';

type DecimalInstance = InstanceType<typeof Decimal>;

/**
 * TrueLayer CARD data → app conventions. Cards are served by a separate API
 * surface (/data/v1/cards) whose conventions are the OPPOSITE of the accounts
 * endpoints in two treacherous ways:
 *
 *  1. Card transactions: a POSITIVE amount is money flowing OUT of the card
 *     ("A positive transaction amount reflects the flow of funds out of a
 *     card, such as a purchase" — TrueLayer docs). Bank accounts use negative
 *     for debits. The app stores signed amounts (expenses negative), so card
 *     amounts are NEGATED.
 *
 *  2. Card balance: `current` is the amount OWED (expenditure, positive), and
 *     `available` is the REMAINING CREDIT — not a balance at all. The app
 *     stores liabilities as negative balances, so the card balance is
 *     -current, and `available` must never be used as a fallback (a £20 debt
 *     on a £3,300 limit would otherwise read as £3,280 in credit).
 *
 * All arithmetic in Decimal; results rounded to 2dp HALF_UP to match the
 * pipeline's normalizeAmount contract.
 */

const round2 = (value: DecimalInstance): number =>
  value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/** Card transaction amount → app-signed amount (purchases negative). */
export const cardAmountToAppSigned = (cardAmount: number): number => {
  if (!Number.isFinite(cardAmount)) {
    return 0;
  }
  return round2(new Decimal(cardAmount).negated().plus(0)); // plus(0) normalises -0
};

/** Card `current` (owed, positive) → app balance (liability, negative). */
export const cardBalanceToAppBalance = (current: number | null | undefined): number => {
  if (typeof current !== 'number' || !Number.isFinite(current)) {
    return 0;
  }
  return round2(new Decimal(current).negated().plus(0));
};

/** Display name for a discovered card, e.g. "Club Credit Card" or "VISA •••• 0044". */
export const cardDisplayName = (card: {
  display_name?: string;
  card_network?: string;
  partial_card_number?: string;
}, fallback: string): string => {
  const displayName = card.display_name?.trim();
  if (displayName) {
    return displayName;
  }
  const network = card.card_network?.trim();
  const partial = card.partial_card_number?.trim();
  if (network && partial) {
    return `${network} •••• ${partial.slice(-4)}`;
  }
  return network || fallback;
};

/** The last-4 mask for a card, from its partial card number. */
export const cardMask = (partialCardNumber: string | undefined): string | undefined => {
  const cleaned = (partialCardNumber ?? '').replace(/\s+/g, '');
  return cleaned.length >= 4 ? cleaned.slice(-4) : cleaned || undefined;
};
