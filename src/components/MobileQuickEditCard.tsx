import React from 'react';
import {
  QuickEditActionStrip,
  QuickEditFieldCell,
  QuickEditFieldList,
  type QuickEditField,
} from './QuickEditRow';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Transaction } from '../types';

/**
 * The register's row editor, stacked into a phone card.
 *
 * On the desktop the editor IS the row: its Date, Description and Category
 * cells become the controls and a strip beneath carries the actions. A phone
 * had none of that — a tap opened the full modal, the category was changed
 * there, saved, closed, and the list came back, one trip per row (the owner,
 * 29 Sep 2026: "Its not as seamless as in the main app"). The editor's pieces
 * were never tied to a table row, only laid out as one, so this lays the same
 * pieces out down a card: the fields the provider offers, each under a
 * caption, then the same strip — Save & Next walks the list exactly as it
 * walks the register, and the match-or-create question appears here in the
 * card rather than in a dialog somewhere else.
 *
 * The full modal is one tap further ("Full editor") for the amount, splits,
 * tags and the rest — the same second tap the desktop gives a row that is
 * already an editor.
 */
export interface MobileQuickEditCardProps {
  transaction: Transaction;
  onFullEditor: (transaction: Transaction) => void;
}

const CAPTIONS: Record<QuickEditField, string> = {
  date: 'Date',
  description: 'Description',
  category: 'Category',
  notes: 'Notes',
};

export default function MobileQuickEditCard({ transaction, onFullEditor }: MobileQuickEditCardProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const isOutgoing = transaction.amount < 0;

  return (
    // Stops the list's own tap handling (view / long-press) from firing under
    // the controls, exactly as the desktop cells stop the row's click.
    <div
      data-quick-edit="card"
      data-testid="register-phone-editor-card"
      onClick={(e) => e.stopPropagation()}
      className="px-3 py-3 bg-navy-400/10 dark:bg-navy-400/25 border-y border-[#6B86B3]/60"
    >
      <div className="flex items-center justify-between mb-2">
        {/* The one figure the editor does not offer to change here: read it
            off the card so the person knows which row they are filing. */}
        <span className={`text-base tabular-nums font-semibold ${isOutgoing ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {formatCurrency(transaction.amount)}
        </span>
        <button
          type="button"
          onClick={() => onFullEditor(transaction)}
          className="text-xs font-medium text-gray-700 dark:text-gray-300 underline underline-offset-2"
        >
          Full editor
        </button>
      </div>
      <div className="space-y-2">
        <QuickEditFieldList>
          {(field) => (
            <div>
              <span className="block mb-1 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {CAPTIONS[field]}
              </span>
              <QuickEditFieldCell field={field} />
            </div>
          )}
        </QuickEditFieldList>
      </div>
      <div className="mt-3">
        <QuickEditActionStrip layout="card" />
      </div>
    </div>
  );
}
