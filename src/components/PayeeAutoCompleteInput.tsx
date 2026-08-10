import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AriaLiveRegion } from './common/AriaLiveRegion';
import { findPayeeCompletion, type PayeeCompletionEntry } from '../utils/payeeAutocomplete';

/**
 * A payee box that completes itself the way Microsoft Money's did: the best
 * match from the user's own payee history is drawn FAINT, ahead of the caret,
 * and Right Arrow — and only Right Arrow — turns it into text.
 *
 * ── THE RULE THIS COMPONENT EXISTS TO MAKE STRUCTURAL ───────────────────────
 * An un-accepted ghost is NEVER committed. Tab away, press Enter, click
 * elsewhere: only the characters the user typed count. That is not enforced by
 * remembering to strip the suggestion at each exit — every exit would have to
 * remember, and one day one of them would not. It is enforced by the input's
 * VALUE never containing the suggestion in the first place. The ghost is a
 * second element painted over the box; `value` holds typed text and nothing
 * else, so there is no code path by which a suggestion can be saved without the
 * user having asked for it.
 *
 * ── HOW THE GHOST IS DRAWN ──────────────────────────────────────────────────
 * An overlay, not a selection. The selection trick (put the completion in the
 * value and select it) puts the suggestion INSIDE the value, which is the one
 * thing the rule above forbids; it also fights every browser's own idea of what
 * a selection means on blur. So: a wrapper the size of the input, an
 * aria-hidden overlay pinned to it, and inside that an INVISIBLE copy of the
 * typed text — which reserves exactly the width the real text occupies — with
 * the remainder drawn after it. The overlay carries the input's own padding,
 * border width, font size and line box, so the two agree on where character
 * n+1 starts; change one and change the other. It is `pointer-events-none`, so
 * a click still lands in the input, and its scroll position is kept in step
 * with the input's for a payee longer than the box.
 *
 * ── WHAT A SCREEN READER GETS ───────────────────────────────────────────────
 * The ghost is `aria-hidden`: it is not typed content and must not be read back
 * as though it were. `aria-autocomplete="inline"` says a completion is offered
 * after the caret — the same vocabulary the app's category and account
 * comboboxes use for their own list completion — and the suggestion itself goes
 * through a polite live region, where it waits its turn instead of interrupting
 * every keystroke.
 */

interface PayeeAutoCompleteInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * The user's payees, ranked — see buildPayeeCompletionIndex. Passed in rather
   * than derived here so the caller decides WHEN the register-wide pass runs;
   * this component is rendered on every keystroke.
   */
  payees: readonly PayeeCompletionEntry[];
  /**
   * A suggestion the user accepted, reported AFTER the value has been set to
   * it. The register uses it to offer the category it usually files this payee
   * under — Money's other courtesy, and never a silent one: the box is filled
   * in where the user can see it and change it.
   */
  onAccept?: (payee: string) => void;
  placeholder?: string;
  /**
   * The input's own styling.
   *
   * ⚠ The ghost overlay hard-codes the metrics that decide where character n+1
   * lands — `px-2.5 py-1.5`, `text-xs`, a 1px border, `rounded-lg`. A caller
   * that changes any of those here must change them there too, or the faint
   * text will start a few pixels off the text it is completing.
   */
  className?: string;
  /**
   * Marks the box required to a screen reader. It no longer decides whether the
   * form submits — the add bar sets `noValidate` so its own checks are the only
   * ones — but "required" is still true and still worth saying.
   */
  required?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  /** The caller's handle on the box — it focuses and selects it from shortcuts. */
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  /**
   * The box has the cursor. The register uses this to build its payee index on
   * demand: the pass is over every transaction the user owns, and paying for it
   * on the register's first paint would be paying it for everyone who never
   * types a payee.
   */
  onFocus?: () => void;
}

/** A key that produces a character, as opposed to one that commands. */
const isPrintableKey = (e: React.KeyboardEvent): boolean =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

export default function PayeeAutoCompleteInput({
  id,
  value,
  onChange,
  payees,
  onAccept,
  placeholder,
  className = '',
  required = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  inputRef,
  onFocus,
}: PayeeAutoCompleteInputProps): React.JSX.Element {
  /** The whole suggested payee (typed characters included), or '' for none. */
  const [suggestion, setSuggestion] = useState('');
  /**
   * Whether a delete has silenced suggestions until the user types afresh.
   *
   * A ref, not state, because the keydown that sets it and the change that
   * reads it are the SAME user action: React batches the two handlers into one
   * render, so a state value read in the change handler would still be the one
   * from before the keystroke — and the ghost would come back on the very
   * backspace meant to dismiss it.
   */
  const suppressedRef = useRef(false);
  const localRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  /** Bumped by an accept, to put the caret at the end once the value has landed. */
  const [caretToEnd, setCaretToEnd] = useState(0);

  const setRefs = useCallback(
    (node: HTMLInputElement | null): void => {
      localRef.current = node;
      if (inputRef) inputRef.current = node;
    },
    [inputRef]
  );

  /**
   * The ghost: only ever the part that is NOT yet typed.
   *
   * Recomputed from the live value rather than stored, so a suggestion left
   * over from a keystroke the value has since moved past can never be drawn.
   *
   * The prefix test is case-insensitive (typing `tesc` may well be completing a
   * payee the bank spells `TESCO`), but the characters ALREADY IN THE BOX keep
   * the user's own case: they are the input's own text, drawn by the input, and
   * the overlay merely reserves their exact width. Re-casing them would mean
   * writing into the value — the one thing the never-committed rule forbids.
   * Accepting the ghost is what adopts the payee's spelling, in full.
   */
  const remainder = useMemo(() => {
    if (suggestion === '' || value === '') return '';
    if (suggestion.length <= value.length) return '';
    if (!suggestion.toLowerCase().startsWith(value.toLowerCase())) return '';
    return suggestion.slice(value.length);
  }, [suggestion, value]);

  // Keep the overlay's horizontal scroll in step with the input's, so a payee
  // longer than the box stays aligned with the text it is completing.
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const input = localRef.current;
    if (overlay && input) overlay.scrollLeft = input.scrollLeft;
  }, [value, remainder]);

  useEffect(() => {
    if (caretToEnd === 0) return;
    const input = localRef.current;
    if (!input) return;
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [caretToEnd]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value;
    onChange(next);
    setSuggestion(suppressedRef.current ? '' : (findPayeeCompletion(next, payees) ?? ''));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // The ghost goes and stays gone until a fresh character is typed — a
      // suggestion that reappeared on the key pressed to be rid of it would be
      // the app arguing. The keystroke itself is untouched and deletes as usual.
      suppressedRef.current = true;
      setSuggestion('');
      return;
    }

    if (
      e.key === 'ArrowRight' &&
      remainder !== '' &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      const input = e.currentTarget;
      // ONLY at the very end, where the ghost begins. Anywhere else — mid-word,
      // or with a selection open — Right Arrow is a caret move and stays one.
      const atEnd =
        input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      if (!atEnd) return;
      e.preventDefault();
      const accepted = suggestion;
      onChange(accepted);
      setSuggestion('');
      setCaretToEnd(token => token + 1);
      onAccept?.(accepted);
      return;
    }

    if (isPrintableKey(e)) suppressedRef.current = false;
  };

  return (
    <div className="relative">
      <input
        id={id}
        ref={setRefs}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        // Leaving the box drops the ghost with it: it was never part of the
        // value, and a faint word left behind on an unfocused field reads as
        // text that is there.
        onBlur={() => setSuggestion('')}
        onScroll={() => {
          const overlay = overlayRef.current;
          const input = localRef.current;
          if (overlay && input) overlay.scrollLeft = input.scrollLeft;
        }}
        placeholder={placeholder}
        className={className}
        required={required}
        // The browser's own saved-form dropdown would cover the ghost with a
        // second, unrelated list of guesses.
        autoComplete="off"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-autocomplete="inline"
      />
      {remainder !== '' && (
        <div
          ref={overlayRef}
          aria-hidden="true"
          // Every spacing utility here is the input's, because the two have to
          // agree on where the typed text ends. `border-transparent` reserves
          // the input's 1px border; `whitespace-pre` keeps a trailing space in
          // a payee from collapsing; `items-center` matches the line box a
          // single-line input centres its text in.
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-lg border border-transparent px-2.5 py-1.5 text-xs"
        >
          {/* The typed characters, drawn by nothing: they reserve the exact
              width the input's own text occupies, so the faint part starts
              where the next character would. */}
          <span className="invisible">{value}</span>
          {/* Faint in both themes, but only as faint as it can afford to be.
              The ghost has to read as "not yet typed" beside the real text and
              still be legible enough to decide on: gray-500 on the white field
              is 4.83:1 (AA), gray-400 on the dark gray-700 field is 4.06:1 —
              the closest the grey scale comes without the suggestion starting
              to look like something the user typed, which would be a worse
              failure than the shortfall. The text is also announced in full
              through the live region below, so nobody has to squint at it. */}
          <span data-payee-ghost className="text-gray-500 dark:text-gray-400">
            {remainder}
          </span>
        </div>
      )}
      {/* Polite: it waits for a gap rather than talking over the typing that
          produced it. clearAfter 0 leaves no timer running behind the box. */}
      <AriaLiveRegion
        message={remainder === '' ? '' : `${suggestion}. Press right arrow to accept.`}
        clearAfter={0}
      />
    </div>
  );
}
