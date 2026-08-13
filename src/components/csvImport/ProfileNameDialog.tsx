import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ProfileNameDialogProps {
  /** "Save these columns" or "Rename" — the same dialog, one job each. */
  title: string;
  /** What the field starts with: empty for a save, the old name for a rename. */
  initialName?: string;
  /** One line saying what the name will be attached to. */
  description: string;
  confirmLabel: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

/**
 * Name an import profile.
 *
 * ── WHY THIS AND NOT window.prompt ──────────────────────────────────────────
 * Saving a profile called `prompt()`. A native prompt cannot be styled, cannot
 * be tested, is blocked outright by some browsers and by every embedded webview,
 * and — this being the part that bit — returns null both when the user cancels
 * and when the browser refuses to show it, so a blocked prompt was
 * indistinguishable from a cancelled one and the Save button silently did
 * nothing. Same idiom as AddWithoutCategoryConfirm and the register's delete
 * confirm: a portaled dialog, focus trapped, Escape cancels, focus returned to
 * whatever opened it.
 *
 * A BLANK NAME IS REFUSED IN PLACE, not swallowed: an unnamed profile in a list
 * of profiles is a row nobody can choose between.
 */
export default function ProfileNameDialog({
  title,
  initialName = '',
  description,
  confirmLabel,
  onConfirm,
  onCancel
}: ProfileNameDialogProps): React.JSX.Element {
  const instanceId = useId();
  const titleId = `${instanceId}-title`;
  const bodyId = `${instanceId}-body`;
  const errorId = `${instanceId}-error`;
  const [name, setName] = useState(initialName);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => {
      opener?.focus({ preventScroll: true });
    };
  }, []);

  const submit = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      setShowEmptyWarning(true);
      inputRef.current?.focus();
      return;
    }
    onConfirm(trimmed);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === 'Tab') {
      // Three focusable things and a closed loop between them, so Tab never
      // wanders off into the wizard behind the dialog.
      const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled])'
      );
      if (!focusable || focusable.length === 0) return;
      const list = Array.from(focusable);
      const current = document.activeElement;
      const index = list.findIndex(element => element === current);
      const nextIndex = event.shiftKey
        ? (index <= 0 ? list.length - 1 : index - 1)
        : (index === list.length - 1 ? 0 : index + 1);
      event.preventDefault();
      list[nextIndex]?.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
      >
        <h3 id={titleId} className="text-lg font-semibold mb-2 dark:text-white">
          {title}
        </h3>
        <p id={bodyId} className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>
        <label
          htmlFor={`${instanceId}-input`}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Name
        </label>
        <input
          id={`${instanceId}-input`}
          ref={inputRef}
          type="text"
          value={name}
          onChange={event => {
            setName(event.target.value);
            if (showEmptyWarning) setShowEmptyWarning(false);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          aria-invalid={showEmptyWarning}
          aria-describedby={showEmptyWarning ? errorId : undefined}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
        {showEmptyWarning && (
          <p id={errorId} role="alert" className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            Give it a name you will recognise next month — an unnamed profile cannot be told
            apart from the others in the list.
          </p>
        )}

        <div className="flex gap-3 justify-end mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
