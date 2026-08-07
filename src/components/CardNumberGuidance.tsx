import { hasMoreThanLastFour, keepLastFour, digitsOnly } from '../utils/accountNumberInput';

interface CardNumberGuidanceProps {
  /** Whatever the card-number field currently holds. */
  value: string;
  /** Replace the field with just the last 4 digits. */
  onKeepLastFour: () => void;
}

/**
 * The explanation and the safety warning that belong beside a credit card's
 * number field — shown both when the account is created and when it is edited
 * later. It lives in one component on purpose: a second copy of a security
 * warning is a second thing to forget to update.
 *
 * The over-length case does not rewrite the field. It says how many digits are
 * there, says nothing has changed yet, and offers the trim as a button naming
 * the four digits that would be kept — so a pasted full card number is a choice
 * the user makes, not something the form does behind their back.
 */
export default function CardNumberGuidance({
  value,
  onKeepLastFour
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
        Never enter the full card number. Everything in this field is kept in
        plain text — it goes into your backups, your JSON export and your audit
        history, and the last 4 digits are all the matching needs.
      </p>
      {hasMoreThanLastFour(value) && (
        <div className="mt-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            That is {digits.length} digits — more than the last 4. Nothing has
            been changed yet; saving would store all of it.
          </p>
          <button
            type="button"
            onClick={onKeepLastFour}
            className="mt-1 text-xs font-medium text-amber-900 dark:text-amber-200 underline hover:no-underline"
          >
            Keep only the last 4 ({keepLastFour(value)})
          </button>
        </div>
      )}
    </>
  );
}
