import React from 'react';
import { PlusIcon } from './icons';

/**
 * A remedy the user can actually press. Two of them at most: past two, the
 * state is a menu and the writing has stopped saying which one to choose.
 */
interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  /**
   * Kept for callers that still pass one, and passed by nothing in the app:
   * DESIGN_PASS §4 rules out illustrations, and a decorative tile above a
   * sentence is the "friendly" register of a consumer app rather than the
   * plain one this product uses.
   */
  icon?: React.ReactNode;
  /** Sentence 1 — WHAT IS ABSENT. A node, so a count can be emphasised. */
  title: React.ReactNode;
  /** Sentence 2 — THE CONSEQUENCE of it being absent. */
  description?: React.ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

/**
 * The empty state, in the one shape the app uses everywhere (DESIGN_PASS §4).
 *
 * ─ CENTRED. OWNER OVERRIDE, 15 August 2026 ─────────────────────────────────
 *
 * §4 ruled this LEFT-ALIGNED: "a centred block with a picture is a greeting",
 * and what an empty register needs is a warning's shape — P6, the consequence
 * then the remedy — read down the left edge like the rest of the page.
 *
 * The owner overruled it, and the reason is the one the ruling could not see
 * from a desktop mock: **on a phone it is not a block on a page, it is the
 * whole screen.** A left-aligned title in a full-width card with nothing to
 * its right reads as a layout that has collapsed, not as a sentence. Centred,
 * it reads as a deliberate state — which is what "filtered-empty is not empty"
 * is trying to make believable in the first place.
 *
 * The ruling's own argument survives it: the shape is still consequence-then-
 * remedy, and the remedy is still a real control. Only the axis changed.
 *
 * Categorisation had been centring its own hand-rolled copy since batch 7,
 * which is what made the inconsistency visible. It is the one that was right.
 *
 *   No transactions in this account yet
 *   Its balance will read £0.00 and it won't appear in reports until
 *   something lands here.
 *   [Add transaction] [Import a statement]
 *
 * The remedy is a REAL CONTROL, not a sentence telling the user where to find
 * one: the whole cost of an empty state is the trip it saves.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = ''
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className={`flex flex-col items-center text-center px-6 py-10 ${className}`}>
      {icon && (
        <div className="mb-4 text-gray-400 dark:text-gray-500">
          {icon}
        </div>
      )}

      <h3 className="text-card font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>

      {description && (
        <p className="mt-1 max-w-2xl text-body text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}

      {/* THE REMEDIES CLEAR 44px WHERE A FINGER IS THE POINTER, and keep the
          register's own control height where a mouse is (the project's mobile
          rule; `lg` is the same breakpoint the register switches from the table
          to the phone's card list at). text-body's 20px line over py-2 is 36px,
          which is a comfortable button under a cursor and a miss under a
          thumb. */}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 [&>button]:min-h-[44px] lg:[&>button]:min-h-0">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#1a2332] text-white text-body font-medium hover:bg-[#2d3a4d] transition-colors duration-state"
            >
              {/* undefined is "no opinion", and gets the default plus; null is
                  "this remedy is not an add" — Clear filters takes something
                  away, and a + in front of it says the opposite. */}
              {action.icon === undefined ? <PlusIcon size={16} /> : action.icon}
              {action.label}
            </button>
          )}

          {/* The second remedy is the SAME rank of thing as the first — per P7
              a secondary outline, beside it, not a quiet link underneath it
              that reads as an afterthought. */}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-line-strong dark:border-gray-600 text-body font-medium text-gray-700 dark:text-gray-300 hover:bg-surface-secondary dark:hover:bg-gray-700 transition-colors duration-state"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
