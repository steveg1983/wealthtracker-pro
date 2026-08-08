import React, { useMemo } from 'react';
import { Modal, ModalBody } from './common/Modal';
import {
  REGISTER_SHORTCUT_GROUPS,
  isAppleKeyboard,
  printableKeys,
} from '../utils/registerShortcuts';

interface RegisterShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The register's keyboard, written out.
 *
 * Rendered entirely from REGISTER_SHORTCUT_GROUPS — the same module the
 * register's key handler is documented against — so the list cannot promise a
 * key the register does not answer to. The modifier prints as ⌘ or Ctrl to
 * match the keyboard in front of the reader; the handlers accept either, so
 * nobody with a mismatched keyboard is left without a shortcut.
 *
 * The house Modal carries the focus trap, the Escape handling, the restore of
 * focus to whatever opened it (the register grid, which is still highlighting
 * a row) and the dark mode.
 */
export default function RegisterShortcutsDialog({
  isOpen,
  onClose,
}: RegisterShortcutsDialogProps): React.JSX.Element | null {
  const apple = useMemo(() => isAppleKeyboard(), []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" size="lg">
      <ModalBody>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          These work while the transaction list itself has the keyboard — click any row
          once, and it does. Typing in the search box or the add bar is never
          interrupted, and the quick edit box that opens under a clicked row keeps its
          own keys (below): in there, Enter accepts what you typed and the Enter after
          it saves and moves you on.
        </p>

        <div className="space-y-6">
          {REGISTER_SHORTCUT_GROUPS.map(group => (
            <section key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                {group.title}
              </h3>
              <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                {group.shortcuts.map(shortcut => (
                  <div
                    key={`${group.title}-${shortcut.keys.join('+')}-${shortcut.what.slice(0, 24)}`}
                    className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
                  >
                    <dt className="flex flex-wrap items-center gap-1 sm:w-48 sm:shrink-0">
                      {printableKeys(shortcut.keys, apple).map((key, index) => (
                        <React.Fragment key={`${key}-${index}`}>
                          {index > 0 && (
                            <span aria-hidden="true" className="text-xs text-gray-400">
                              +
                            </span>
                          )}
                          <kbd className="px-1.5 py-0.5 text-xs font-semibold rounded border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                      {shortcut.alsoKeys && (
                        <>
                          <span className="text-xs text-gray-500 dark:text-gray-400">or</span>
                          {printableKeys(shortcut.alsoKeys, apple).map((key, index) => (
                            <React.Fragment key={`also-${key}-${index}`}>
                              {index > 0 && (
                                <span aria-hidden="true" className="text-xs text-gray-400">
                                  +
                                </span>
                              )}
                              <kbd className="px-1.5 py-0.5 text-xs font-semibold rounded border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                                {key}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </>
                      )}
                    </dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300 sm:flex-1">
                      {shortcut.what}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        {/* The two keys people expect and will not find, said out loud rather
            than left as a mystery — a shortcut that silently does nothing is
            worse than one that was never offered. */}
        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          {apple ? '⌘' : 'Ctrl'}+N and {apple ? '⌘' : 'Ctrl'}+T are missing on purpose: every
          browser keeps those for opening its own windows and tabs, and a page cannot take
          them back. That is why a new transaction is <kbd className="px-1 py-0.5 text-[11px] font-semibold rounded border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">+</kbd>.
        </p>
      </ModalBody>
    </Modal>
  );
}
