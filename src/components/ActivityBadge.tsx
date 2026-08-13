import React from 'react';
import { useActivityTracking } from '../hooks/useActivityTracking';

/**
 * Activity badges — and the one decision they all share.
 *
 * Every badge in this file used to be `bg-red-500`, with `NavigationBadge`
 * alone on `bg-blue-500`. That is expense red spent on a COUNT, and it is the
 * inversion already corrected twice: on the reconciliation list, where four
 * amber chips competed with the one amber that means "your next move", and on
 * the Accounts page, where the same ruling landed on the UNRECONCILED figure
 * (DESIGN_RULINGS_2026-08-12, ruling A).
 *
 * The ruling generalises, and this file is where it generalises TO — five
 * badges, one of them live, all of them wearing a signal they had not earned:
 *
 *   colour marks what needs attention. A count is not a next action.
 *
 * ── WHAT THE CALLER ACTUALLY MEANS ──────────────────────────────────────────
 *
 * Worth checking rather than assuming, because it decides the default. There
 * is exactly one call site in the app: `layout/NavComponents.tsx` renders
 * `NavigationBadge` on the sidebar's Accounts and Budget links, and every badge
 * here is fed by the same source — `useActivityTracking().getUnreadCount()`,
 * which counts rows the person has not looked at yet. Nothing in that is
 * wrong, overdue, failing or owed. It is "there are six things in here you
 * have not seen", which is the definition of a count.
 *
 * So neutral is the DEFAULT rather than an option, and red is the thing a
 * caller has to ask for. `tone="warning"` is there for a genuine warning — a
 * figure whose meaning is that something needs fixing — and today nothing
 * passes it. That is the correct state of affairs: the opt-in exists so that
 * the next person with a real warning does not have to re-argue this, not
 * because anything currently qualifies.
 *
 * The neutral palette is not invented here — it is the shipped chip from
 * `reconciliation/ReconciliationAccountList.tsx`, which is the de-amber pass's
 * own output, so a badge and a chip agree. (`#f1f3f7` / `#475569` from the
 * ruling, as the tokens that already hold those values.) No `tabular-nums`:
 * `index.css` makes tabular figures the app-wide default precisely so 96 call
 * sites stopped asking for it one class at a time.
 */

/**
 * What a badge's colour is claiming.
 *
 * `warning` is deliberately the long word to type. Reaching for it should feel
 * like a decision, because it is one — it spends the colour the app reserves
 * for what a number MEANS.
 */
export type BadgeTone = 'neutral' | 'warning';

/** Background + ink for a badge that carries a figure. */
const TONE_FILL: Record<BadgeTone, string> = {
  neutral: 'bg-surface-tertiary text-slate-600 dark:bg-gray-700 dark:text-gray-300',
  warning: 'bg-danger text-white'
};

/**
 * A badge with no figure in it — the bare dot.
 *
 * Neutral here is the INK colour rather than the chip's fill: a dot painted
 * `#f1f3f7` on a white header would be a dot nobody can see, which is a
 * different failure from the one being fixed. It reads as a quiet mark in the
 * same grey the counts are written in.
 */
const TONE_DOT: Record<BadgeTone, string> = {
  neutral: 'bg-slate-600 dark:bg-gray-300',
  warning: 'bg-danger'
};

interface ActivityBadgeProps {
  type?: 'transaction' | 'account' | 'budget' | 'goal' | 'sync' | 'system';
  variant?: 'dot' | 'count' | 'both';
  className?: string;
  showIfZero?: boolean;
  max?: number;
  tone?: BadgeTone;
}

export default function ActivityBadge({
  type,
  variant = 'count',
  className = '',
  showIfZero = false,
  max = 99,
  tone = 'neutral'
}: ActivityBadgeProps): React.JSX.Element | null {
  const { getUnreadCount } = useActivityTracking();
  const count = getUnreadCount(type);

  if (count === 0 && !showIfZero) {
    return null;
  }

  if (variant === 'dot') {
    return count > 0 ? (
      <span className={`w-2 h-2 ${TONE_DOT[tone]} rounded-full ${className}`} />
    ) : null;
  }

  if (variant === 'count') {
    return (
      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium ${TONE_FILL[tone]} rounded-full ${className}`}>
        {count > max ? `${max}+` : count}
      </span>
    );
  }

  // variant === 'both'
  return count > 0 ? (
    <div className={`relative inline-block ${className}`}>
      {/* The pulse follows the tone, and only the tone. A ping is an
          attention-demand in motion, which is the same thing red was doing
          and costs the same thing when spent on a count — worse, actually,
          since motion cannot be ignored the way a colour can. A neutral badge
          sits still. */}
      {tone === 'warning' && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-danger rounded-full animate-ping motion-reduce:animate-none" />
      )}
      <span className={`absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium ${TONE_FILL[tone]} rounded-full`}>
        {count > max ? `${max}+` : count}
      </span>
    </div>
  ) : null;
}

/**
 * Inline badge for navigation items — the one badge the app actually renders.
 *
 * Was `bg-blue-500`, which is the "and some of them are blue" half of the
 * finding. Blue means nothing in this product, so it was neither a warning nor
 * neutral; it was a third thing that had to be learned.
 */
export function NavigationBadge({
  type,
  className = '',
  tone = 'neutral'
}: {
  type?: ActivityBadgeProps['type'];
  className?: string;
  tone?: BadgeTone;
}): React.JSX.Element | null {
  const { getUnreadCount } = useActivityTracking();
  const count = getUnreadCount(type);

  if (count === 0) return null;

  return (
    <span className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium ${TONE_FILL[tone]} rounded-full ${className}`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

// Card badge for dashboard widgets
export function CardBadge({
  type,
  position = 'top-right',
  pulse = true,
  tone = 'neutral'
}: {
  type?: ActivityBadgeProps['type'];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  pulse?: boolean;
  tone?: BadgeTone;
}): React.JSX.Element | null {
  const { getUnreadCount, getNewSinceLastCheck } = useActivityTracking();
  const count = getUnreadCount(type);
  const newActivities = getNewSinceLastCheck();
  const hasNew = type ? newActivities.some(a => a.type === type) : newActivities.length > 0;

  if (count === 0) return null;

  const positionClasses = {
    'top-right': 'top-2 right-2',
    'top-left': 'top-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'bottom-left': 'bottom-2 left-2'
  };

  return (
    <div className={`absolute ${positionClasses[position]}`}>
      {/* `pulse` is now a permission rather than an instruction: a caller may
          switch the motion off, but cannot switch it on for a count. Same
          argument as ActivityBadge's 'both' variant. */}
      {pulse && hasNew && tone === 'warning' && (
        <span className="absolute w-full h-full bg-danger rounded-full animate-ping motion-reduce:animate-none" />
      )}
      {/* shadow-lg is gone with the colour: a badge is not one of the two
          things DESIGN_PASS §2.5 leaves a shadow to (an overlay, and the
          floating selected row). */}
      <span className={`relative inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-medium ${TONE_FILL[tone]} rounded-full`}>
        {count > 99 ? '99+' : count}
      </span>
    </div>
  );
}

/**
 * Text badge for inline use.
 *
 * Already colour-on-text rather than a filled chip, so the only change is
 * which grey — blue-700 said "this is a link" about a number that is not one.
 */
export function InlineBadge({
  type,
  prefix = 'New: ',
  className = ''
}: {
  type?: ActivityBadgeProps['type'];
  prefix?: string;
  className?: string;
}): React.JSX.Element | null {
  const { getUnreadCount } = useActivityTracking();
  const count = getUnreadCount(type);

  if (count === 0) return null;

  return (
    <span className={`text-xs font-medium text-slate-600 dark:text-gray-300 ${className}`}>
      {prefix}{count}
    </span>
  );
}

// Icon badge overlay
export function IconBadge({
  children,
  type,
  showDot = false,
  tone = 'neutral'
}: {
  children: React.ReactNode;
  type?: ActivityBadgeProps['type'];
  showDot?: boolean;
  tone?: BadgeTone;
}): React.JSX.Element {
  const { getUnreadCount } = useActivityTracking();
  const count = getUnreadCount(type);

  return (
    <div className="relative inline-flex">
      {children}
      {count > 0 && (
        showDot ? (
          <span className={`absolute -top-1 -right-1 w-3 h-3 ${TONE_DOT[tone]} border-2 border-white dark:border-gray-800 rounded-full`} />
        ) : (
          <span className={`absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-medium ${TONE_FILL[tone]} rounded-full`}>
            {count > 9 ? '9+' : count}
          </span>
        )
      )}
    </div>
  );
}
