import { forwardRef, useCallback, useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from 'react';
import {
  formatMoneyForDisplay,
  reflectsEmittedValue,
  sanitizeMoneyKeystroke,
  stripGrouping
} from '../../utils/moneyInput';

// Everything a caller can still pass through to the underlying <input>. The
// money behaviour owns value/onChange/type/inputMode, and step/min/max are
// number-input concepts that a text field would silently ignore — grouping and
// sign are controlled by `decimals` and `allowNegative` instead.
type PassThroughInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode' | 'step' | 'min' | 'max'
>;

export interface MoneyInputProps extends PassThroughInputProps {
  /** The caller's own state: an ungrouped numeric string ("1000000.5") or a number. */
  value: string | number | null | undefined;
  /** Receives the ungrouped raw text ("1000000.5", or '' when cleared) — never the grouped display. */
  onChange: (rawValue: string) => void;
  /** Permit a leading minus. Off by default: most money fields are non-negative. */
  allowNegative?: boolean;
  /** Decimal places shown when idle, and the cap while typing. */
  decimals?: number;
  /** Select the whole amount on focus so typing replaces it (house behaviour). */
  selectOnFocus?: boolean;
}

/**
 * A money text field: grouped digits when idle, plain typing while focused.
 *
 * It reformats on blur rather than under the caret, matching the Edit
 * Transaction amount field — live regrouping fights the caret on every
 * thousands boundary.
 */
const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  {
    value,
    onChange,
    allowNegative = false,
    decimals = 2,
    selectOnFocus = true,
    placeholder = '0.00',
    className = '',
    onBlur,
    onFocus,
    ...inputProps
  },
  forwardedRef
) {
  // What the user is currently typing, or null when the field just mirrors
  // `value`. Holding the raw string means the grouping is applied once, on
  // blur, instead of shifting the caret mid-amount.
  const [draft, setDraft] = useState<string | null>(null);
  const lastEmitted = useRef<string | null>(null);
  const localRef = useRef<HTMLInputElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  // If the caller replaces the value behind us — a form reset after submit, a
  // background sync — the draft is stale and must give way, even mid-edit.
  useEffect(() => {
    if (lastEmitted.current === null) return;
    if (!reflectsEmittedValue(value, lastEmitted.current)) {
      lastEmitted.current = null;
      setDraft(null);
    }
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const sanitized = sanitizeMoneyKeystroke(event.target.value, { allowNegative, decimals });
    const raw = stripGrouping(sanitized);
    setDraft(sanitized);
    lastEmitted.current = raw;
    onChange(raw);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    // Hand the field back to `value`, which renders grouped.
    setDraft(null);
    lastEmitted.current = null;
    onBlur?.(event);
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
    if (selectOnFocus) {
      localRef.current?.select();
    }
    onFocus?.(event);
  };

  return (
    <input
      // A caller may still ask for autofill; everything below the spread is
      // what makes this a money field and is not negotiable.
      autoComplete="off"
      {...inputProps}
      ref={setRefs}
      type="text"
      inputMode="decimal"
      // A SPELL-CHECKED AMOUNT IS NONSENSE. This field is deliberately
      // `type="text"` so it can hold "1,234.50" while it is being typed — which
      // also hands it to the browser's dictionary, and a red underline under
      // somebody's opening balance says the app thinks the money is misspelled.
      // Autocapitalise has even less to answer for: there is no letter here it
      // could capitalise, and on a phone it puts the keyboard in the wrong
      // shift state to start a number.
      spellCheck={false}
      autoCapitalize="none"
      value={draft ?? formatMoneyForDisplay(value, decimals)}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={className}
    />
  );
});

export default MoneyInput;
