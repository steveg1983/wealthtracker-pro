import { hasMoreThanLastFour, keepLastFour, digitsOnly } from '../utils/accountNumberInput';

interface CardNumberGuidanceProps {
  /** Whatever the card-number field currently holds. */
  value: string;
}

/**
 * The explanation and the safety warning that belong beside a credit card's
 * number field — shown both when the account is created and when it is edited
 * later. It lives in one component on purpose: a second copy of a security
 * warning is a second thing to forget to update.
 *
 * The over-length case states what will happen rather than offering a button
 * that could be ignored. Saving keeps the last 4 whatever the field holds (see
 * accountNumberForStorage), so the panel names the four digits that survive
 * and says the rest is dropped — the user is told, not asked.
 *
 * Its live region is rendered empty rather than mounted along with the panel:
 * a screen reader only announces a status that was already in the page when
 * its text appeared, and this is the one message here nobody should miss.
 */
export default function CardNumberGuidance({
  value
}: CardNumberGuidanceProps): React.JSX.Element {
  const digits = digitsOnly(value);

  return (
    <>
      {/* ONE line, and NOT amber. Claude Design, 15 August.
       *
       * It was two paragraphs — about fifty words under one optional field, in
       * a modal where no other field has any — and the second was in the
       * warning pair. Applying their own export test: a warning describes a
       * consequence OUTSIDE the app of the action about to be taken, and a
       * reader who skims it can be harmed. This says the opposite. Nothing the
       * user types can escape, because the app drops it before saving.
       *
       * That is a REASSURANCE, and the ruling names it as a fourth category
       * beside caveat / warning / next action:
       *
       *   Reassurance — states a protection the app applies to the user's
       *   data. Neutral or positive. Never the warning pair.
       *
       * Amber here made the reader tense at the colour and then read text
       * telling them they are safe. The writing was already good; only the
       * colour was making a claim the words did not. */}
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        The last 4 digits are what match this account to your bank feed. Anything
        longer is dropped when you save — a full card number is never stored.
      </p>
      <div role="status">
        {hasMoreThanLastFour(value) && (
          /* The live one goes the same way, and for the same reason. It tells
             you what the app is about to protect you from, which is the
             reassurance category again — the reader has done nothing wrong,
             and amber says they have. It stays a panel so it is still noticed;
             it stops being an alarm. (Design ruled on the static line; this is
             their principle applied to its neighbour, which is worth their
             confirming.) */
          <div className="mt-2 rounded-xl border border-line dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
            <p className="text-xs text-gray-600 dark:text-gray-300">
              That is {digits.length} digits. Saving will store {keepLastFour(value)} and
              discard the rest.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
