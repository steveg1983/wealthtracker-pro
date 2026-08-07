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
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        The last 4 digits printed on the card are what matches this account to
        your bank feed, so a linked card lands here instead of asking you every
        time.
      </p>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
        Only the last 4 digits are ever saved. Anything longer is dropped when
        you save, so a full card number never reaches your backups, your JSON
        export or your audit history.
      </p>
      <div role="status">
        {hasMoreThanLastFour(value) && (
          <div className="mt-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              That is {digits.length} digits. Saving will store {keepLastFour(value)} and
              discard the rest.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
